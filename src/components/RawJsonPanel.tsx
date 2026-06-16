import type { AgentStatusResponse } from "../types/agent";
import type { PipelineResult, CircuitAnalysisResult, PortVisualizationResult } from "../types/pipeline";
import { getStageData } from "../utils/pipeline";

type Props = {
  pipeline: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null;
  agent: AgentStatusResponse | null;
  selectedReferenceId?: string | null;
  runtimeMetadata: Record<string, unknown> | null;
};

export function RawJsonPanel({ pipeline, agent, selectedReferenceId, runtimeMetadata }: Props) {
  const hasRuntimeMetadata = pipeline && "runtime_metadata" in pipeline;
  const metadata = runtimeMetadata ?? (hasRuntimeMetadata ? pipeline.runtime_metadata : {});
  const currentNetlist =
    pipeline && "stages" in pipeline
      ? getStageData(pipeline, "topology").netlist_v2 ?? null
      : null;

  return (
    <section className="raw-panel">
      <details>
        <summary>Reference</summary>
        <pre>{JSON.stringify({ selectedReferenceId }, null, 2)}</pre>
      </details>
      <details>
        <summary>当前 netlist_v2（S3 topology / 修正后）</summary>
        <pre>{JSON.stringify(currentNetlist ?? {}, null, 2)}</pre>
      </details>
      <details>
        <summary>runtime_metadata</summary>
        <pre>{JSON.stringify(metadata, null, 2)}</pre>
      </details>
      <details>
        <summary>Pipeline 原始输出</summary>
        <pre>{JSON.stringify(pipeline ?? {}, null, 2)}</pre>
      </details>
      <details>
        <summary>Agent 原始输出</summary>
        <pre>{JSON.stringify(agent ?? {}, null, 2)}</pre>
      </details>
    </section>
  );
}
