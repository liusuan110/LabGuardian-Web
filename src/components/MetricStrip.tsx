import { CircuitBoard, Gauge, GitBranch, ShieldCheck } from "lucide-react";
import type { PipelineResult, CircuitAnalysisResult, PortVisualizationResult } from "../types/pipeline";
import { asPercent, getNetCount } from "../utils/pipeline";

type Props = {
  result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null;
};

export function MetricStrip({ result }: Props) {
  const metrics = [
    {
      label: "元件数",
      value: result?.component_count ?? "-",
      icon: <CircuitBoard size={18} />,
    },
    {
      label: "网络数",
      value: result ? getNetCount(result) : "-",
      icon: <GitBranch size={18} />,
    },
    {
      label: "完成度",
      value: result && "progress" in result ? asPercent(result.progress) : "-",
      icon: <Gauge size={18} />,
    },
    {
      label: "风险",
      value: result && "risk_level" in result ? result.risk_level : "-",
      icon: <ShieldCheck size={18} />,
    },
  ];

  return (
    <section className="metric-strip">
      {metrics.map((metric) => (
        <div className="metric-card" key={metric.label}>
          {metric.icon}
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
        </div>
      ))}
    </section>
  );
}
