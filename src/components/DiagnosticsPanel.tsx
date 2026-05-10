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
  const comparisonReport =
    hasPipelineFields && "comparison_report" in result && result.comparison_report && typeof result.comparison_report === "object"
      ? (result.comparison_report as Record<string, unknown>)
      : null;
  const diagnosticItems = Array.isArray(comparisonReport?.items)
    ? (comparisonReport?.items as Array<Record<string, unknown>>)
    : [];
  const semanticItems =
    hasPipelineFields &&
    "stages" in result &&
    Array.isArray(result.stages)
      ? (
          result.stages.find((stage) => stage.stage === "semantic_analysis")?.data
            ?.wiring_errors as Array<Record<string, unknown>> | undefined
        ) ?? []
      : [];

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
        <h2>诊断摘要</h2>
        <div className="diagnostic-list">
          {(diagnostics.length ? diagnostics : ["运行完整诊断后显示 validator 输出。"]).map(
            (item: string, index: number) => (
              <p key={`${item}-${index}`}>{item}</p>
            ),
          )}
        </div>
      </section>

      <section className="side-section">
        <h2>错误码明细</h2>
        <div className="diagnostic-list">
          {diagnosticItems.length ? (
            diagnosticItems.map((item, index) => {
              const code = String(item.error_code ?? "UNKNOWN");
              const message = String(item.message ?? "");
              const severity = String(item.severity ?? "warning");
              const componentId = item.current_component_id ?? item.component_id;
              const hole = item.current_hole_id;
              const node = item.current_node_id;
              return (
                <article key={`${code}-${index}`} className={`diagnostic-item severity-${severity}`}>
                  <div className="diagnostic-item-head">
                    <strong>{code}</strong>
                    {componentId ? <span>元件 {String(componentId)}</span> : null}
                  </div>
                  <p>{message || "暂无描述"}</p>
                  <p className="diagnostic-item-meta">
                    {hole ? `孔位: ${String(hole)} ` : ""}
                    {node ? `节点: ${String(node)}` : ""}
                  </p>
                </article>
              );
            })
          ) : (
            <p>暂无结构化错误码。</p>
          )}
        </div>
      </section>

      <section className="side-section">
        <h2>语义检错</h2>
        <div className="diagnostic-list">
          {semanticItems.length ? (
            semanticItems.map((item, index) => (
              <article key={`semantic-${index}`} className="diagnostic-item">
                <div className="diagnostic-item-head">
                  <strong>{String(item.error_code ?? "SEMANTIC_WIRING_ERROR")}</strong>
                  {item.component_id ? <span>元件 {String(item.component_id)}</span> : null}
                </div>
                <p>{String(item.message ?? "暂无语义检错描述")}</p>
              </article>
            ))
          ) : (
            <p>暂无语义检错项。</p>
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
