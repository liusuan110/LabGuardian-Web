import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import type { PipelineResult, CircuitAnalysisResult, PortVisualizationResult } from "../types/pipeline";
import { asPercent } from "../utils/pipeline";

type Props = {
  result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null;
};

function riskIcon(risk: string | undefined) {
  if (risk === "danger") return <ShieldAlert size={20} />;
  if (risk === "warning") return <AlertTriangle size={20} />;
  return <ShieldCheck size={20} />;
}

export function DiagnosticsPanel({ result }: Props) {
  const hasPipelineFields = result && "risk_level" in result;
  const diagnostics = hasPipelineFields && "diagnostics" in result ? Array.isArray(result.diagnostics) ? result.diagnostics : [] : [];
  const riskReasons = hasPipelineFields && "risk_reasons" in result ? Array.isArray(result.risk_reasons) ? result.risk_reasons : [] : [];

  return (
    <aside className="diagnostics-panel">
      <section className={`risk-card risk-${hasPipelineFields ? result?.risk_level ?? "none" : "none"}`}>
        <div>
          {riskIcon(hasPipelineFields ? result?.risk_level : undefined)}
          <span>风险等级</span>
        </div>
        <strong>{hasPipelineFields ? result?.risk_level ?? "等待诊断" : "等待诊断"}</strong>
        <p>
          完成度 {hasPipelineFields && result && "progress" in result ? asPercent(result.progress) : "-"} · 相似度{" "}
          {hasPipelineFields && result && "similarity" in result ? asPercent(result.similarity) : "-"}
        </p>
      </section>

      <section className="side-section">
        <h2>诊断条目</h2>
        <div className="diagnostic-list">
          {(diagnostics.length ? diagnostics : ["运行完整诊断后显示 validator 输出。"]).map(
            (item: string, index: number) => (
              <p key={`${item}-${index}`}>{item}</p>
            ),
          )}
        </div>
      </section>

      <section className="side-section">
        <h2>风险原因</h2>
        <div className="diagnostic-list">
          {(riskReasons.length ? riskReasons : ["暂无高风险原因。"]).map((item: string, index: number) => (
            <p key={`${item}-${index}`}>{item}</p>
          ))}
        </div>
      </section>
    </aside>
  );
}
