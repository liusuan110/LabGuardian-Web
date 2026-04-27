import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import type { PipelineResult } from "../types/pipeline";
import { asPercent } from "../utils/pipeline";

type Props = {
  result: PipelineResult | null;
};

function riskIcon(risk: string | undefined) {
  if (risk === "danger") return <ShieldAlert size={20} />;
  if (risk === "warning") return <AlertTriangle size={20} />;
  return <ShieldCheck size={20} />;
}

export function DiagnosticsPanel({ result }: Props) {
  const diagnostics = Array.isArray(result?.diagnostics) ? result.diagnostics : [];
  const riskReasons = Array.isArray(result?.risk_reasons) ? result.risk_reasons : [];

  return (
    <aside className="diagnostics-panel">
      <section className={`risk-card risk-${result?.risk_level ?? "none"}`}>
        <div>
          {riskIcon(result?.risk_level)}
          <span>风险等级</span>
        </div>
        <strong>{result?.risk_level ?? "等待诊断"}</strong>
        <p>
          完成度 {result ? asPercent(result.progress) : "-"} · 相似度{" "}
          {result ? asPercent(result.similarity) : "-"}
        </p>
      </section>

      <section className="side-section">
        <h2>诊断条目</h2>
        <div className="diagnostic-list">
          {(diagnostics.length ? diagnostics : ["运行完整诊断后显示 validator 输出。"]).map(
            (item, index) => (
              <p key={`${item}-${index}`}>{item}</p>
            ),
          )}
        </div>
      </section>

      <section className="side-section">
        <h2>风险原因</h2>
        <div className="diagnostic-list">
          {(riskReasons.length ? riskReasons : ["暂无高风险原因。"]).map((item, index) => (
            <p key={`${item}-${index}`}>{item}</p>
          ))}
        </div>
      </section>
    </aside>
  );
}
