import { CheckCircle2, Loader2, Circle } from "lucide-react";
import type { PipelineResult, CircuitAnalysisResult, PipelineStageName, PortVisualizationResult } from "../types/pipeline";
import type { PipelineProgress } from "../features/demo/demoReducer";
import type { RunState } from "../types/ui";
import { formatDuration, getStage, stageLabel } from "../utils/pipeline";

const order: PipelineStageName[] = ["detect", "pin_detect", "mapping", "topology", "validate"];

type Props = {
  result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null;
  progress: PipelineProgress;
  runState: RunState;
};

export function StageTimeline({ result, progress, runState }: Props) {
  const hasStages = result && "stages" in result;
  const isRunning = runState === "running";
  const showSkeleton = isRunning || hasStages;

  return (
    <section className="stage-panel">
      <div className="panel-heading">
        <h2>阶段耗时</h2>
        <span>
          {hasStages
            ? formatDuration((result as PipelineResult).total_duration_ms)
            : isRunning
            ? "运行中..."
            : "等待运行"}
        </span>
      </div>
      <div className="stage-list">
        {showSkeleton
          ? order.map((stage) => {
              const item = hasStages ? getStage(result as PipelineResult, stage) : null;
              const isDone = hasStages
                ? Boolean(item)
                : progress.completedStages.includes(stage);
              const isActive = !hasStages && progress.activeStage === stage;
              const className = `stage-item ${isDone ? "done" : ""} ${isActive ? "active" : ""}`.trim();
              const Icon = isDone ? CheckCircle2 : isActive ? Loader2 : Circle;
              const duration = isDone
                ? hasStages
                  ? formatDuration(item?.duration_ms)
                  : "✓"
                : isActive
                ? "..."
                : "—";
              return (
                <div className={className} key={stage}>
                  <Icon size={17} className={isActive ? "spin" : undefined} />
                  <span>{stageLabel(stage)}</span>
                  <strong>{duration}</strong>
                </div>
              );
            })
          : null}
      </div>
    </section>
  );
}
