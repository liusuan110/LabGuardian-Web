import { useEffect, useRef, useState } from "react";
import type {
  CircuitAnalysisResult,
  EvidenceRef,
  Pin,
  PipelineComponent,
  PipelineResult,
  PortVisualizationResult,
} from "../types/pipeline";
import type { CanvasMode } from "../types/ui";
import { isIcLikeComponent, normalizePackageType } from "../utils/icAnnotations";
import { getDetections, getMappedComponents, getPinComponents } from "../utils/pipeline";

type Props = {
  imageUrl: string;
  result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null;
  mode: CanvasMode;
  highlightTargets?: EvidenceRef[];
};

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  ctx.save();
  ctx.font = "28px Inter, sans-serif";
  const padding = 8;
  const metrics = ctx.measureText(text);
  const width = metrics.width + padding * 2;
  const height = 36;
  const safeX = Math.max(0, Math.min(x, ctx.canvas.width - width));
  const safeY = Math.max(height, y);
  ctx.fillStyle = color;
  ctx.fillRect(safeX, safeY - height, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, safeX + padding, safeY - 10);
  ctx.restore();
}

function drawBox(ctx: CanvasRenderingContext2D, bbox: number[], label: string, color: string) {
  if (bbox.length < 4) return;
  const [x1, y1, x2, y2] = bbox;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  drawLabel(ctx, label, x1, y1 - 10, color);
  ctx.restore();
}

function topPoint(component: PipelineComponent, pinIndex: number) {
  const pin = component.pins?.[pinIndex];
  if (!pin) return null;
  const top = pin.keypoints_by_view?.top;
  if (top) return top;
  if (typeof pin.x_image === "number" && typeof pin.y_image === "number") {
    return [pin.x_image, pin.y_image];
  }
  return null;
}

function drawPin(
  ctx: CanvasRenderingContext2D,
  point: number[] | null | undefined,
  label: string,
  color: string,
) {
  if (!point || point.length < 2) return;
  const [x, y] = point;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = "#1b2522";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawLabel(ctx, label, x + 14, y - 12, "#31544e");
  ctx.restore();
}

function isHighlighted(
  componentId: string | undefined,
  pinName: string | undefined,
  holeId: string | undefined,
  electricalNetId: string | undefined,
  targets: EvidenceRef[],
): boolean {
  for (const t of targets) {
    switch (t.type) {
      case "component":
        if (componentId && t.component_id === componentId) return true;
        break;
      case "pin":
        if (componentId && t.component_id === componentId && (!t.pin_name || t.pin_name === pinName)) return true;
        if (holeId && t.hole_id === holeId) return true;
        break;
      case "net":
        if (electricalNetId && t.electrical_net_id === electricalNetId) return true;
        break;
      case "reference_component":
        break;
    }
  }
  return false;
}

function drawComponents(
  ctx: CanvasRenderingContext2D,
  components: PipelineComponent[],
  mode: CanvasMode,
  showComponentBoxes: boolean,
  targets: EvidenceRef[],
) {
  components.forEach((component, componentIndex) => {
    const baseColor = ["#14796b", "#2563eb", "#b45309", "#7c3aed"][componentIndex % 4];
    const compHighlighted = isHighlighted(component.component_id, undefined, undefined, undefined, targets);
    const color = compHighlighted ? "#be3144" : baseColor;
    if (showComponentBoxes && component.bbox) {
      drawBox(
        ctx,
        component.bbox,
        `${component.component_id ?? ""} ${component.component_type ?? "UNKNOWN"}`.trim(),
        color,
      );
    }
    component.pins?.forEach((pin, pinIndex) => {
      const point = topPoint(component, pinIndex);
      const baseLabel =
        pin.polarity_role && pin.polarity_role !== "UNKNOWN"
          ? pin.polarity_role
          : pin.polarity_candidate_role && pin.polarity_candidate_role !== "UNKNOWN"
            ? pin.polarity_candidate_role
            : pin.pin_display_name ?? pin.pin_name ?? `pin${pinIndex + 1}`;
      const suffix =
        mode === "mapping" ? ` ${pin.hole_id ?? "-"} ${pin.electrical_node_id ?? ""}` : "";
      const pinHighlighted = isHighlighted(component.component_id, pin.pin_name, pin.hole_id, pin.electrical_net_id, targets);
      drawPin(ctx, point, `${baseLabel}${suffix}`, pinHighlighted ? "#ff5722" : "#ffd166");
    });
  });
}

function getExpectedPinCount(packageType: string | undefined): number | null {
  const normalized = normalizePackageType(packageType);
  if (normalized === "dip8") return 8;
  if (normalized === "dip14") return 14;
  return null;
}

function displayPinName(pin: Pin | undefined, fallback: string): string {
  if (!pin) return fallback;
  return pin.polarity_role && pin.polarity_role !== "UNKNOWN"
    ? pin.polarity_role
    : pin.polarity_candidate_role && pin.polarity_candidate_role !== "UNKNOWN"
      ? pin.polarity_candidate_role
      : pin.pin_display_name || pin.pin_name || fallback;
}

function pinSource(pin: Pin | undefined): string {
  return pin?.source ?? pin?.source_by_view?.top ?? "-";
}

function pinCoordinate(pin: Pin | undefined): string {
  if (!pin) return "-";
  const point = pin.keypoints_by_view?.top;
  if (point && point.length >= 2) {
    return `${Math.round(point[0])}, ${Math.round(point[1])}`;
  }
  if (typeof pin.x_image === "number" && typeof pin.y_image === "number") {
    return `${Math.round(pin.x_image)}, ${Math.round(pin.y_image)}`;
  }
  return "-";
}

function normalizedPinKey(pin: Pin): string {
  return (pin.pin_name ?? pin.pin_display_name ?? "").trim().toLowerCase();
}

function getDisplayPins(component: PipelineComponent): Array<{ label: string; pin?: Pin }> {
  const pins = component.pins ?? [];
  const expectedCount = getExpectedPinCount(component.package_type);
  if (!expectedCount || !isIcLikeComponent(component)) {
    return pins.map((pin, index) => ({ label: displayPinName(pin, `pin${index + 1}`), pin }));
  }

  return Array.from({ length: expectedCount }, (_, index) => {
    const label = `pin${index + 1}`;
    const pin =
      pins.find((candidate) => normalizedPinKey(candidate) === label) ??
      pins.find((candidate) => candidate.pin_id === index + 1);
    return { label, pin };
  });
}

function PinCoordinateView({ result }: { result: Props["result"] }) {
  const components = getMappedComponents(result);

  if (components.length === 0) {
    return (
      <section className="mapping-panel">
        <div className="panel-heading">
          <h2>孔位映射</h2>
        </div>
        <p className="muted">等待 S2 孔位映射阶段完成...</p>
      </section>
    );
  }

  return (
    <section className="mapping-panel">
      <div className="panel-heading">
        <h2>元件引脚与面包板坐标</h2>
        <span>{components.length} 个元件</span>
      </div>

      <div className="pin-coordinate-list">
        {components.map((comp) => (
          <div key={comp.component_id} className="pin-coordinate-card">
            <div className="component-header">
              <span className="component-id">{comp.component_id}</span>
              <span className="component-type">{comp.component_type}</span>
              {comp.package_type ? (
                <span className="component-package">{normalizePackageType(comp.package_type)}</span>
              ) : null}
            </div>
            {isIcLikeComponent(comp) && !getExpectedPinCount(comp.package_type) ? (
              <p className="ic-package-warning">封装类型不确定，请检查芯片检测框</p>
            ) : null}
            <div className="pins-container">
              {getDisplayPins(comp).map(({ label, pin }, index) => (
                <div key={`${comp.component_id}-${label}-${index}`} className="pin-item">
                  <span className="pin-name">{label}</span>
                  <span className="arrow">→</span>
                  <span className="hole-coord">{pin?.hole_id || "-"}</span>
                  {pin?.electrical_node_id ? (
                    <>
                      <span className="arrow">→</span>
                      <span className="net-id">{pin.electrical_node_id}</span>
                    </>
                  ) : null}
                  <span className="pin-source">source={pinSource(pin)}</span>
                  <span className="pin-point">{pinCoordinate(pin)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ResultCanvas({ imageUrl, result, mode, highlightTargets = [] }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [showPinModeBoxes, setShowPinModeBoxes] = useState(true);

  useEffect(() => {
    if (!imageUrl) {
      setImage(null);
      return;
    }
    const nextImage = new Image();
    nextImage.onload = () => setImage(nextImage);
    nextImage.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);

    if (!result) return;

    if (mode === "detect") {
      getDetections(result).forEach((detection, index) => {
        if (!detection.bbox) return;
        const highlighted = isHighlighted(detection.component_id, undefined, undefined, undefined, highlightTargets);
        const label = `${detection.component_id ?? `D${index + 1}`} ${
          detection.component_type ?? detection.class_name ?? "UNKNOWN"
        }`;
        drawBox(ctx, detection.bbox, label, highlighted ? "#be3144" : "#14796b");
      });
    }

    if (mode === "pins") {
      drawComponents(ctx, getPinComponents(result), mode, showPinModeBoxes, highlightTargets);
    }

    if (mode === "mapping") {
      drawComponents(ctx, getMappedComponents(result), mode, true, highlightTargets);
    }
  }, [image, mode, result, showPinModeBoxes, highlightTargets]);

  if (mode === "mapping") {
    return <PinCoordinateView result={result} />;
  }

  if (!imageUrl) {
    return <div className="empty-stage">上传图片后显示检测框、引脚点。</div>;
  }

  return (
    <>
      {mode === "pins" ? (
        <div className="canvas-tools">
          <button
            type="button"
            className="canvas-toggle-btn"
            onClick={() => setShowPinModeBoxes((current) => !current)}
          >
            {showPinModeBoxes ? "只看引脚" : "显示元件框"}
          </button>
        </div>
      ) : null}
      <canvas ref={canvasRef} className="result-canvas" />
    </>
  );
}
