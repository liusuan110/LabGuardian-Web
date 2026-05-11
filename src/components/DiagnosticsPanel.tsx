import { AlertTriangle, ShieldAlert, ShieldCheck, BookOpen, ChevronDown } from "lucide-react";
import type {
  PipelineResult,
  CircuitAnalysisResult,
  PortVisualizationResult,
  ComparisonReport,
  ComparisonReportItem,
  EvidenceRef,
} from "../types/pipeline";
import { asPercent } from "../utils/pipeline";

type Props = {
  result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null;
  selectedDiagnosticIndex?: number | null;
  onSelectDiagnostic?: (index: number | null) => void;
};

const ERROR_LABELS: Record<string, string> = {
  COMPONENT_MISSING: "缺元件",
  COMPONENT_EXTRA: "多余元件",
  WRONG_CONNECTION: "错接",
  OPEN_CIRCUIT: "断路",
  EXTRA_CONNECTION: "多余连接",
  INCOMPLETE_CIRCUIT: "电路未完成",
  ROLE_MISMATCH: "网络角色错误",
  INPUT_NODE_MISMATCH: "输入节点错误",
  OUTPUT_NODE_MISMATCH: "输出节点错误",
  POWER_NODE_MISMATCH: "正电节点错误",
  GROUND_NODE_MISMATCH: "地节点错误",
  ROLE_TARGET_NOT_CONNECTED: "标记位置未连接",
};

const POLARITY_CODES = new Set(["POLARITY_REVERSED", "POLARITY_UNKNOWN"]);

function formatEvidenceRef(ref: EvidenceRef): string {
  switch (ref.type) {
    case "component":
      return `元件 ${ref.component_id}`;
    case "pin":
      return `引脚 ${ref.component_id}.${ref.pin_name}${ref.hole_id ? `@${ref.hole_id}` : ""}`;
    case "net":
      return `网络 ${ref.electrical_net_id}`;
    case "reference_component":
      return `参考元件 ${ref.component_id}`;
    default:
      return "";
  }
}

const SEVERITY_ORDER: Record<string, number> = {
  fatal: 0,
  error: 1,
  warning: 2,
  info: 3,
};

function riskIcon(risk: string | undefined) {
  if (risk === "danger") return <ShieldAlert size={20} />;
  if (risk === "warning") return <AlertTriangle size={20} />;
  return <ShieldCheck size={20} />;
}

function severityLabel(s: string | undefined) {
  if (s === "fatal") return "致命";
  if (s === "error") return "错误";
  if (s === "warning") return "警告";
  if (s === "info") return "信息";
  return s || "未知";
}

function severityClass(s: string | undefined) {
  if (s === "fatal" || s === "error") return "severity-error";
  if (s === "warning") return "severity-warning";
  return "severity-info";
}

function parseComparisonReport(result: unknown): ComparisonReport | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  if (!("comparison_report" in r)) return null;
  const cr = r.comparison_report;
  if (!cr || typeof cr !== "object") return null;
  return cr as ComparisonReport;
}

function formatComponentInfo(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const id = d.component_id ?? d.id ?? "";
  const type = d.component_type ?? d.type ?? d.class_name ?? "";
  if (!id && !type) return null;
  if (type) return `${String(id)}(${String(type)})`;
  return String(id);
}

function JsonDetail({ label, data }: { label: string; data: unknown }) {
  if (data === undefined) return null;
  return (
    <details className="json-detail">
      <summary>
        <ChevronDown size={14} />
        {label}
      </summary>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </details>
  );
}

function ComparisonDiffCard({
  item,
  index,
  isSelected,
  onClick,
}: {
  item: ComparisonReportItem;
  index: number;
  isSelected?: boolean;
  onClick?: () => void;
}) {
  const code = item.error_code ?? "UNKNOWN";
  const label = item.title ?? ERROR_LABELS[code] ?? code;
  const sev = String(item.severity ?? "warning");

  const refInfo = formatComponentInfo(item.component_ref);
  const actualInfo = formatComponentInfo(item.component_actual);

  return (
    <article
      className={`comparison-diff-card ${severityClass(sev)}${isSelected ? " selected" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.();
      }}
    >
      <div className="comparison-diff-head">
        <strong className="comparison-diff-title">{label}</strong>
        <span className={`comparison-diff-badge ${severityClass(sev)}`}>{severityLabel(sev)}</span>
      </div>
      <code className="comparison-diff-code">{code}</code>
      {item.message ? <p className="comparison-diff-message">{item.message}</p> : null}
      {item.suggested_action ? (
        <p className="comparison-diff-suggestion">
          <BookOpen size={13} />
          {item.suggested_action}
        </p>
      ) : null}
      {refInfo || actualInfo ? (
        <p className="comparison-diff-mapping">
          {refInfo ? <span className="mapping-ref">参考元件 {refInfo}</span> : null}
          {refInfo && actualInfo ? <span className="mapping-arrow"> → 匹配到 → </span> : null}
          {actualInfo ? <span className="mapping-actual">当前元件 {actualInfo}</span> : null}
        </p>
      ) : null}
      {item.evidence_refs && item.evidence_refs.length > 0 ? (
        <p className="comparison-diff-evidence">
          {item.evidence_refs.map((ref, i) => (
            <span key={i} className="evidence-tag">{formatEvidenceRef(ref)}</span>
          ))}
        </p>
      ) : null}
      <div className="comparison-diff-details">
        <JsonDetail label="期望连接关系 (expected)" data={item.expected} />
        <JsonDetail label="实际连接关系 (actual)" data={item.actual} />
      </div>
    </article>
  );
}

export function DiagnosticsPanel({ result, selectedDiagnosticIndex, onSelectDiagnostic }: Props) {
  const hasPipelineFields = result && "risk_level" in result;
  const diagnostics = hasPipelineFields && "diagnostics" in result ? (Array.isArray(result.diagnostics) ? result.diagnostics : []) : [];
  const riskReasons = hasPipelineFields && "risk_reasons" in result ? (Array.isArray(result.risk_reasons) ? result.risk_reasons : []) : [];

  const cr = parseComparisonReport(result);
  const summary = cr?.summary;
  const items = cr?.items ?? [];

  const isLogicalGraph = summary?.comparison_mode === "logical_graph";
  const logicCorrect = summary?.logic_correct === true;
  const similarity = typeof summary?.similarity === "number" ? summary.similarity : null;
  const referenceName = summary?.reference_name;
  const totalItemCount = typeof summary?.total_item_count === "number" ? summary.total_item_count : items.length;

  const ignoreComponentId = summary?.ignore_component_id === true;
  const ignoreHoleId = summary?.ignore_hole_id === true;
  const ignorePassivePinOrder = summary?.ignore_passive_pin_order === true;
  const ignorePolarity = summary?.ignore_polarity === true;

  const filteredItems = items.filter((item) => {
    const code = String(item.error_code ?? "");
    if (code === "HOLE_MISMATCH") return false;
    if (POLARITY_CODES.has(code)) return false;
    return true;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    const sa = SEVERITY_ORDER[String(a.severity ?? "warning")] ?? 99;
    const sb = SEVERITY_ORDER[String(b.severity ?? "warning")] ?? 99;
    return sa - sb;
  });

  const semanticItems =
    hasPipelineFields && "stages" in result && Array.isArray(result.stages)
      ? (result.stages.find((stage) => stage.stage === "semantic_analysis")?.data?.wiring_errors as Array<Record<string, unknown>> | undefined) ?? []
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

      {/* ===== 参考电路逻辑比较 ===== */}
      {isLogicalGraph ? (
        <section className={`comparison-summary-card ${logicCorrect ? "correct" : "incorrect"}`}>
          <div className="comparison-summary-header">
            <BookOpen size={18} />
            <span>逻辑网表图比较</span>
          </div>
          <strong className="comparison-summary-status">
            {logicCorrect
              ? "逻辑正确：当前电路与参考电路连接关系等价。"
              : "逻辑不一致"}
          </strong>
          {similarity !== null ? (
            <p className="comparison-summary-similarity">相似度 {asPercent(similarity)}</p>
          ) : null}
          {referenceName ? (
            <p className="comparison-summary-ref">
              参考电路：{referenceName}
            </p>
          ) : null}
          <p className="comparison-summary-hint">
            元件编号和具体孔位可以不同；系统按元件类型、网络连接关系和输入/输出/电源/地角色判断。
          </p>
          {(ignoreComponentId || ignoreHoleId || ignorePassivePinOrder || ignorePolarity) ? (
            <div className="comparison-ignore-badges">
              {ignoreComponentId ? <span className="ignore-badge">忽略元件编号</span> : null}
              {ignoreHoleId ? <span className="ignore-badge">忽略具体孔位</span> : null}
              {ignorePassivePinOrder ? <span className="ignore-badge">无极性两脚元件允许引脚互换</span> : null}
              {ignorePolarity ? <span className="ignore-badge">忽略极性</span> : null}
            </div>
          ) : null}
          <p className="comparison-summary-hint">
            当前版本默认元件极性正确，不进行极性错误判断。
          </p>
          {logicCorrect && filteredItems.length === 0 ? (
            <p className="comparison-summary-hint">
              {totalItemCount === 0
                ? "当前电路与参考电路连接关系一致。"
                : "手动修正后，当前电路逻辑连接与参考电路一致。"}
            </p>
          ) : null}
          {!logicCorrect && filteredItems.length > 0 ? (
            <p className="comparison-summary-hint">
              发现 {filteredItems.length} 处与参考电路不一致，详见下方。
            </p>
          ) : null}
        </section>
      ) : null}

      {/* ===== 差异列表 ===== */}
      {isLogicalGraph && sortedItems.length > 0 ? (
        <section className="side-section">
          <h2>与参考电路的差异</h2>
          <div className="comparison-diff-list">
            {sortedItems.map((item, idx) => (
              <ComparisonDiffCard
                key={`${item.error_code ?? "item"}-${idx}`}
                item={item}
                index={idx}
                isSelected={selectedDiagnosticIndex === idx}
                onClick={() => onSelectDiagnostic?.(idx)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="side-section">
        <h2>诊断摘要</h2>
        <div className="diagnostic-list">
          {(diagnostics.length ? diagnostics : ["运行完整诊断后显示 validator 输出。"]).map((item: string, index: number) => (
            <p key={`${item}-${index}`}>{item}</p>
          ))}
        </div>
      </section>

      {/* ===== 传统错误码明细（向后兼容） ===== */}
      <section className="side-section">
        <h2>错误码明细</h2>
        <div className="diagnostic-list">
          {sortedItems.length === 0 ? (
            <p>暂无结构化错误码。</p>
          ) : (
            sortedItems.map((item, index) => {
              const code = String(item.error_code ?? "UNKNOWN");
              const label = ERROR_LABELS[code] ?? code;
              const message = item.message ?? "";
              const sev = String(item.severity ?? "warning");
              const suggestion = item.suggested_action ?? "";
              return (
                <article key={`legacy-${code}-${index}`} className={`diagnostic-item severity-${severityClass(sev)}`}>
                  <div className="diagnostic-item-head">
                    <strong>
                      {label} <span className="code-tag">{code}</span>
                    </strong>
                  </div>
                  <p>{message || "暂无描述"}</p>
                  {suggestion ? <p className="diagnostic-item-meta">建议: {suggestion}</p> : null}
                </article>
              );
            })
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
