import type { AgentStatusResponse } from "../types/agent";
import type { PipelineResult } from "../types/pipeline";

type Props = {
  pipeline: PipelineResult | null;
  agent: AgentStatusResponse | null;
  runtimeMetadata: Record<string, unknown> | null;
};

export function RawJsonPanel({ pipeline, agent, runtimeMetadata }: Props) {
  return (
    <section className="raw-panel">
      <details open>
        <summary>runtime_metadata</summary>
        <pre>{JSON.stringify(runtimeMetadata ?? pipeline?.runtime_metadata ?? {}, null, 2)}</pre>
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
