import { AlertTriangle, Bot, ShieldAlert, ShieldCheck } from "lucide-react";
import type { AgentStatusResponse } from "../types/agent";
import type { PipelineResult } from "../types/pipeline";
import { asPercent } from "../utils/pipeline";

type Props = {
  result: PipelineResult | null;
  agentStatus: "idle" | "running" | "success" | "error";
  agentResult: AgentStatusResponse | null;
  agentError: string;
};

function riskIcon(risk: string | undefined) {
  if (risk === "danger") return <ShieldAlert size={20} />;
  if (risk === "warning") return <AlertTriangle size={20} />;
  return <ShieldCheck size={20} />;
}

export function DiagnosticsPanel({ result, agentStatus, agentResult, agentError }: Props) {
  const agentAnswer = agentResult?.result?.answer;
  const actions = agentResult?.result?.actions ?? [];

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
          {(result?.diagnostics?.length ? result.diagnostics : ["运行完整诊断后显示 validator 输出。"]).map(
            (item, index) => (
              <p key={`${item}-${index}`}>{item}</p>
            ),
          )}
        </div>
      </section>

      <section className="side-section">
        <h2>风险原因</h2>
        <div className="diagnostic-list">
          {(result?.risk_reasons?.length ? result.risk_reasons : ["暂无高风险原因。"]).map((item, index) => (
            <p key={`${item}-${index}`}>{item}</p>
          ))}
        </div>
      </section>

      <section className="side-section agent-section">
        <h2>
          <Bot size={18} />
          Agent 解释
        </h2>
        {agentStatus === "running" && <p className="muted">正在生成诊断解释...</p>}
        {agentStatus === "error" && <p className="error-text">{agentError}</p>}
        {agentAnswer ? <p className="agent-answer">{agentAnswer}</p> : null}
        {actions.length ? (
          <div className="action-list">
            {actions.map((action) => (
              <article key={`${action.action_type}-${action.label}`}>
                <strong>{action.label}</strong>
                <span>{action.detail}</span>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </aside>
  );
}
