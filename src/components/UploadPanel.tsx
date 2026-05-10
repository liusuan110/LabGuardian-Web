import { Play, SlidersHorizontal, UploadCloud } from "lucide-react";
import type { ChangeEvent, DragEvent } from "react";
import type { PipelineStageName, RailAssignments } from "../types/pipeline";
import type { RunState } from "../types/ui";
import { formatBytes } from "../utils/file";

const STAGE_RUN_LABEL: Record<PipelineStageName, string> = {
  detect: "正在做目标检测...",
  pin_detect: "正在定位引脚...",
  mapping: "正在映射孔位...",
  topology: "正在构建网表...",
  validate: "正在校验风险...",
  semantic_analysis: "正在分析电路语义...",
};

type Props = {
  file: File | null;
  conf: number;
  iou: number;
  imgsz: number;
  rails: RailAssignments;
  runState: RunState;
  activeStage?: PipelineStageName | null;
  onFileSelected: (file: File) => void;
  onOptionChange: (key: "conf" | "iou" | "imgsz", value: number) => void;
  onRailChange: (key: keyof RailAssignments, value: string) => void;
  onRun: () => void;
};

const railLabels: Array<[keyof RailAssignments, string]> = [
  ["top_plus", "上 +"],
  ["top_minus", "上 -"],
  ["bot_plus", "下 +"],
  ["bot_minus", "下 -"],
];

export function UploadPanel({
  file,
  conf,
  iou,
  imgsz,
  rails,
  runState,
  activeStage,
  onFileSelected,
  onOptionChange,
  onRailChange,
  onRun,
}: Props) {
  const isRunning = runState === "running";

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (selected) onFileSelected(selected);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const selected = event.dataTransfer.files?.[0];
    if (selected) onFileSelected(selected);
  }

  return (
    <aside className="input-panel">
      <label
        className="dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <input type="file" accept="image/*" onChange={handleInput} />
        <UploadCloud size={34} />
        <strong>{file ? file.name : "选择或拖入面包板图片"}</strong>
        <span>{file ? formatBytes(file.size) : "浏览器端转 base64 后提交完整 pipeline"}</span>
      </label>

      <section className="control-group">
        <div className="section-title">
          <SlidersHorizontal size={16} />
          <span>推理参数</span>
        </div>
        <label>
          置信度
          <input
            type="number"
            min="0.01"
            max="0.99"
            step="0.01"
            value={conf}
            onChange={(event) => onOptionChange("conf", Number(event.target.value))}
          />
        </label>
        <label>
          IOU
          <input
            type="number"
            min="0.01"
            max="0.99"
            step="0.01"
            value={iou}
            onChange={(event) => onOptionChange("iou", Number(event.target.value))}
          />
        </label>
        <label>
          imgsz
          <input
            type="number"
            min="320"
            max="1920"
            step="32"
            value={imgsz}
            onChange={(event) => onOptionChange("imgsz", Number(event.target.value))}
          />
        </label>
      </section>

      <section className="control-group">
        <div className="section-title">
          <span>电源轨</span>
        </div>
        <div className="rail-grid">
          {railLabels.map(([key, label]) => (
            <label key={key}>
              {label}
              <select value={rails[key]} onChange={(event) => onRailChange(key, event.target.value)}>
                <option value="VCC">VCC</option>
                <option value="GND">GND</option>
                <option value="FLOAT">FLOAT</option>
              </select>
            </label>
          ))}
        </div>
      </section>

      <button className="run-button" type="button" disabled={!file || isRunning} onClick={onRun}>
        <Play size={18} />
        <span>
          {isRunning
            ? activeStage
              ? STAGE_RUN_LABEL[activeStage]
              : "Pipeline 运行中..."
            : "运行完整诊断"}
        </span>
      </button>
    </aside>
  );
}
