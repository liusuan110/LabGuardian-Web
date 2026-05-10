import { useEffect, useRef, useState } from "react";
import type { PipelineComponent, PipelineResult, CircuitAnalysisResult, PortVisualizationResult } from "../types/pipeline";
import type { CanvasMode } from "../types/ui";
import { getDetections, getMappedComponents, getPinComponents, getStageData } from "../utils/pipeline";

type Props = {
  imageUrl: string;
  result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null;
  mode: CanvasMode;
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
  return component.pins?.[pinIndex]?.keypoints_by_view?.top ?? null;
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

function drawComponents(
  ctx: CanvasRenderingContext2D,
  components: PipelineComponent[],
  mode: CanvasMode,
  showComponentBoxes: boolean,
) {
  components.forEach((component, componentIndex) => {
    const color = ["#14796b", "#2563eb", "#b45309", "#7c3aed"][componentIndex % 4];
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
      const suffix =
        mode === "mapping" ? ` ${pin.hole_id ?? "-"} ${pin.electrical_node_id ?? ""}` : "";
      drawPin(ctx, point, `${pin.pin_name ?? `pin${pinIndex + 1}`}${suffix}`, "#ffd166");
    });
  });
}

function PinCoordinateView({ result }: { result: PipelineResult }) {
  const mappingData = getStageData(result, "mapping");

  const components =
    (mappingData.components as Array<{
      component_id?: string;
      component_type?: string;
      pins?: Array<{
        pin_id?: number;
        pin_name?: string;
        hole_id?: string;
        electrical_node_id?: string;
      }>;
    }>) || [];

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
        <h2>元件引脚面包板坐标</h2>
        <span>{components.length} 个元件</span>
      </div>

      <div className="pin-coordinate-list">
        {components.map((comp) => (
          <div key={comp.component_id} className="pin-coordinate-card">
            <div className="component-header">
              <span className="component-id">{comp.component_id}</span>
              <span className="component-type">{comp.component_type}</span>
            </div>
            <div className="pins-container">
              {comp.pins?.map((pin) => (
                <div key={pin.pin_id} className="pin-item">
                  <span className="pin-name">{pin.pin_name || `pin${pin.pin_id}`}</span>
                  <span className="arrow">→</span>
                  <span className="hole-coord">{pin.hole_id || "-"}</span>
                  {pin.electrical_node_id && (
                    <>
                      <span className="arrow">→</span>
                      <span className="net-id">{pin.electrical_node_id}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ResultCanvas({ imageUrl, result, mode }: Props) {
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
        const label = `${detection.component_id ?? `D${index + 1}`} ${
          detection.component_type ?? detection.class_name ?? "UNKNOWN"
        }`;
        drawBox(ctx, detection.bbox, label, "#14796b");
      });
    }

    if (mode === "pins") {
      drawComponents(ctx, getPinComponents(result), mode, showPinModeBoxes);
    }

    if (mode === "mapping") {
      drawComponents(ctx, getMappedComponents(result), mode, true);
    }
  }, [image, mode, result, showPinModeBoxes]);

  if (mode === "mapping") {
    if (!result || !("stages" in result)) {
      return <div className="empty-stage compact">等待 S2 孔位映射阶段完成...</div>;
    }
    return <PinCoordinateView result={result as PipelineResult} />;
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
