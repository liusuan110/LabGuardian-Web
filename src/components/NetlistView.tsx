import type { PipelineResult } from "../types/pipeline";
import { getStageData } from "../utils/pipeline";

type Props = {
  result: PipelineResult | null;
};

export function NetlistView({ result }: Props) {
  const topology = getStageData(result, "topology");
  const netlist = topology.netlist_v2;
  const nets = netlist?.nets ?? [];

  if (!result) {
    return <div className="empty-stage compact">网表将在 S3 拓扑阶段完成后显示。</div>;
  }

  return (
    <section className="netlist-panel">
      <div className="panel-heading">
        <h2>netlist_v2</h2>
        <span>{nets.length} nets</span>
      </div>
      <div className="net-grid">
        {nets.length ? (
          nets.slice(0, 12).map((net, index) => (
            <article className="net-card" key={`${net.net_id ?? net.electrical_net_id ?? index}`}>
              <strong>{String(net.net_id ?? net.electrical_net_id ?? `NET-${index + 1}`)}</strong>
              <span>{JSON.stringify(net.nodes ?? net.pins ?? []).slice(0, 120)}</span>
            </article>
          ))
        ) : (
          <p className="muted">当前结果未返回 nets，查看原始 JSON 可核对 topology 输出。</p>
        )}
      </div>
    </section>
  );
}
