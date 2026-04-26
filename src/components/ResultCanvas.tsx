import { useEffect, useRef, useState } from "react";
import type { PipelineComponent, PipelineResult } from "../types/pipeline";
import type { CanvasMode } from "../types/ui";
import { getDetections, getMappedComponents, getPinComponents } from "../utils/pipeline";

type Props = {
  imageUrl: string;
  result: PipelineResult | null;
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

function drawComponents(ctx: CanvasRenderingContext2D, components: PipelineComponent[], mode: CanvasMode) {
  components.forEach((component, componentIndex) => {
    const color = ["#14796b", "#2563eb", "#b45309", "#7c3aed"][componentIndex % 4];
    if (component.bbox) {
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

export function ResultCanvas({ imageUrl, result, mode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

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
      drawComponents(ctx, getPinComponents(result), mode);
    }

    if (mode === "mapping") {
      drawComponents(ctx, getMappedComponents(result), mode);
    }
  }, [image, mode, result]);

  if (!imageUrl) {
    return <div className="empty-stage">上传图片后显示检测框、引脚点和孔位映射。</div>;
  }

  return <canvas ref={canvasRef} className="result-canvas" />;
}
