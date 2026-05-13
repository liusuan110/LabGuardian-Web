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

function formatSummaryValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return value >= 0 && value <= 1 ? asPercent(value) : String(value);
  if (typeof value === "string") return value;
  return "-";
}

function mappingEntries(mapping: unknown): Array<[string, string]> {
  if (!mapping || typeof mapping !== "object") return [];
  return Object.entries(mapping as Record<string, unknown>).flatMap(([key, value]) =>
    typeof value === "string" ? [[key, value] as [string, string]] : [],
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
  const allowExtraWires = summary?.allow_extra_wires === true;
  const strictFunctionalPinRoles = summary?.strict_functional_pin_roles === true;
  const componentMapping = mappingEntries(
    cr?.ref_to_current_component_mapping ?? summary?.ref_to_current_component_mapping,
  );
  const netMapping = mappingEntries(
    cr?.ref_to_current_net_mapping ?? summary?.ref_to_current_net_mapping,
  );
  const inferredNetRoles = Array.isArray(summary?.inferred_net_roles) ? summary.inferred_net_roles : [];
  const roleInferenceApplied = summary?.role_inference_applied === true || inferredNetRoles.length > 0;
  const autoSymmetryGroups = Array.isArray(summary?.auto_symmetry_groups) ? summary.auto_symmetry_groups : [];
  const portAnnotationsApplied = Array.isArray(summary?.port_annotations_applied)
    ? summary.port_annotations_applied
    : [];

  const sortedItems = [...items].sort((a, b) => {
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
          <div className="comparison-summary-grid">
            <span>comparison_mode</span><strong>{formatSummaryValue(summary?.comparison_mode)}</strong>
            <span>match_type</span><strong>{formatSummaryValue(summary?.match_type)}</strong>
            <span>similarity</span><strong>{formatSummaryValue(summary?.similarity)}</strong>
            <span>progress</span><strong>{formatSummaryValue(summary?.progress)}</strong>
            <span>reference_id</span><strong>{formatSummaryValue(summary?.reference_id)}</strong>
            <span>reference_name</span><strong>{formatSummaryValue(summary?.reference_name)}</strong>
            <span>ignore_component_id</span><strong>{formatSummaryValue(summary?.ignore_component_id)}</strong>
            <span>ignore_hole_id</span><strong>{formatSummaryValue(summary?.ignore_hole_id)}</strong>
            <span>ignore_passive_pin_order</span><strong>{formatSummaryValue(summary?.ignore_passive_pin_order)}</strong>
            <span>strict_functional_pin_roles</span><strong>{formatSummaryValue(summary?.strict_functional_pin_roles)}</strong>
            <span>equivalence_rule</span><strong>{formatSummaryValue(summary?.equivalence_rule)}</strong>
          </div>
          <p className="comparison-summary-hint">
            逻辑参考电路用于拓扑比较，不要求孔位一致，不要求元件编号一致；系统按元件类型、网络连接关系和端口语义标注判断。
          </p>
          {(ignoreComponentId || ignoreHoleId || ignorePassivePinOrder || ignorePolarity || allowExtraWires || strictFunctionalPinRoles) ? (
            <div className="comparison-ignore-badges">
              {ignoreComponentId ? <span className="ignore-badge">忽略元件编号</span> : null}
              {ignoreHoleId ? <span className="ignore-badge">忽略具体孔位</span> : null}
              {ignorePassivePinOrder ? <span className="ignore-badge">无极性两脚元件允许引脚互换</span> : null}
              {ignorePolarity ? <span className="ignore-badge">忽略极性</span> : null}
              {allowExtraWires ? <span className="ignore-badge">允许额外连线</span> : null}
              {strictFunctionalPinRoles ? <span className="ignore-badge">严格功能引脚角色</span> : null}
            </div>
          ) : null}
          {(componentMapping.length > 0 || netMapping.length > 0) ? (
            <div className="logical-mapping-block">
              <strong>逻辑映射关系</strong>
              {componentMapping.length > 0 ? (
                <div>
                  <span className="mapping-section-title">参考元件映射</span>
                  {componentMapping.map(([ref, current]) => (
                    <code key={`comp-${ref}`}>{ref} -&gt; {current}</code>
                  ))}
                </div>
              ) : null}
              {netMapping.length > 0 ? (
                <div>
                  <span className="mapping-section-title">参考网络映射</span>
                  {netMapping.map(([ref, current]) => (
                    <code key={`net-${ref}`}>{ref} -&gt; {current}</code>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {logicCorrect && items.length === 0 ? (
            <p className="comparison-summary-hint">
              {totalItemCount === 0
                ? "当前电路与参考电路连接关系一致。"
                : "手动修正后，当前电路逻辑连接与参考电路一致。"}
            </p>
          ) : null}
          {!logicCorrect && items.length > 0 ? (
            <p className="comparison-summary-hint">
              发现 {items.length} 处与参考电路不一致，详见下方。
            </p>
          ) : null}
        </section>
      ) : null}

      {/* ===== 系统自动推断 / 对称识别 / 端口标注摘要 ===== */}
      {isLogicalGraph && (roleInferenceApplied || autoSymmetryGroups.length > 0 || portAnnotationsApplied.length > 0) ? (
        <section className="side-section">
          <h2>系统自动行为</h2>
          {roleInferenceApplied ? (
            <article className="diagnostic-item severity-info">
              <div className="diagnostic-item-head">
                <strong>系统已推断 {inferredNetRoles.length} 个网络角色</strong>
              </div>
              {inferredNetRoles.length > 0 ? (
                <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                  {inferredNetRoles.map((entry, idx) => (
                    <li key={`inferred-${idx}`}>
                      <code>{entry.current_net ?? "?"}</code>
                      {" → "}
                      <code>{entry.reference_net ?? "?"}</code>
                      {" · "}
                      {entry.role ?? "?"}
                      {entry.role_label ? ` (${entry.role_label})` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="diagnostic-item-meta">
                未由用户明确标注的网络由系统从拓扑反推角色，结果若不正确可在"高级：网络角色全标注"中覆盖。
              </p>
            </article>
          ) : null}
          {autoSymmetryGroups.length > 0 ? (
            <article className="diagnostic-item severity-info">
              <div className="diagnostic-item-head">
                <strong>自动识别的对称组</strong>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {autoSymmetryGroups.flatMap((group, gi) =>
                  (group.nets ?? []).map((pair, pi) => (
                    <span
                      key={`sym-${gi}-${pi}`}
                      className="ignore-badge"
                      style={{ background: "rgba(99, 102, 241, 0.12)" }}
                    >
                      {Array.isArray(pair) ? pair.join(" ↔ ") : String(pair)}
                    </span>
                  )),
                )}
              </div>
              <p className="diagnostic-item-meta">
                这些参考网络的标签可在比较时互换（如差分对的 UI1 ↔ UI2）。
              </p>
            </article>
          ) : null}
          {portAnnotationsApplied.length > 0 ? (
            <article className="diagnostic-item severity-info">
              <div className="diagnostic-item-head">
                <strong>已应用 {portAnnotationsApplied.length} 个端口标注</strong>
              </div>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {portAnnotationsApplied.map((entry, idx) => (
                  <li key={`pa-${idx}`}>
                    <code>{entry.electrical_net_id ?? "?"}</code>
                    {" · "}
                    {entry.role ?? "?"}
                    {entry.role_label ? ` (${entry.role_label})` : ""}
                    {entry.resolved_by ? ` · 来源:${entry.resolved_by}` : ""}
                  </li>
                ))}
              </ul>
            </article>
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
