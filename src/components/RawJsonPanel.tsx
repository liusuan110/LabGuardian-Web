import type { AgentStatusResponse } from "../types/agent";
import type { PipelineResult, CircuitAnalysisResult, PortVisualizationResult } from "../types/pipeline";

type Props = {
  pipeline: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null;
  agent: AgentStatusResponse | null;
  runtimeMetadata: Record<string, unknown> | null;
};

export function RawJsonPanel({ pipeline, agent, runtimeMetadata }: Props) {
  const hasRuntimeMetadata = pipeline && "runtime_metadata" in pipeline;
  const metadata = runtimeMetadata ?? (hasRuntimeMetadata ? pipeline.runtime_metadata : {});

  return (
    <section className="raw-panel">
      <details open>
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
