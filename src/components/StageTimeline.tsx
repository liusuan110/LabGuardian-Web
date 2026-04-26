import { CheckCircle2 } from "lucide-react";
import type { PipelineResult, PipelineStageName } from "../types/pipeline";
import { formatDuration, getStage, stageLabel } from "../utils/pipeline";

const order: PipelineStageName[] = ["detect", "pin_detect", "mapping", "topology", "validate"];

type Props = {
  result: PipelineResult | null;
};

export function StageTimeline({ result }: Props) {
  return (
    <section className="stage-panel">
      <div className="panel-heading">
        <h2>阶段耗时</h2>
        <span>{result ? formatDuration(result.total_duration_ms) : "等待运行"}</span>
      </div>
      <div className="stage-list">
        {order.map((stage) => {
          const item = getStage(result, stage);
          return (
            <div className={`stage-item ${item ? "done" : ""}`} key={stage}>
              <CheckCircle2 size={17} />
              <span>{stageLabel(stage)}</span>
              <strong>{formatDuration(item?.duration_ms)}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}
