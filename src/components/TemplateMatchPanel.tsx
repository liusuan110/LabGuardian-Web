/**
 * TemplateMatchPanel — CADx Phase 0 read-only visualization.
 *
 * Renders the top-K topology hypotheses produced by the backend template
 * matcher (`app/domain/templates/matcher.py::match_all_templates`). Designed
 * to sit beside `GnnAdvisoryPanel` in `DiagnosticsPanel`, showing the user
 * what canonical topology the system *thinks* their circuit is — even when
 * the legacy Phase E comparator can't tell (e.g. user picked the wrong
 * reference, or wanted multi-hypothesis output).
 *
 * Phase 0 caveats (intentional):
 *  - Read-only: no "采用此识别" button (that's Phase 1).
 *  - No interaction with the rest of the diagnostic pipeline — this is a
 *    pure side-channel display while we validate matcher quality.
 *  - Hidden entirely when `template_match` is absent (older backends or
 *    when matcher fails silently).
 */

import { Sparkles } from "lucide-react";
import type { TemplateMatchResult, TemplateMatchSummary } from "../types/templates";

type Props = {
  templateMatch: TemplateMatchSummary | null;
};

/** Confidence bands aligned with the GNN p_correct color scheme for
 *  visual consistency across the diagnostics panel. */
function confidenceBand(confidence: number): "high" | "mid" | "low" {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.5) return "mid";
  return "low";
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return "高置信";
  if (confidence >= 0.5) return "中等";
  if (confidence > 0) return "低置信";
  return "无匹配";
}

function variantLabel(variant: string | null): string | null {
  if (!variant) return null;
  return variant;
}

function MatchRow({ result }: { result: TemplateMatchResult }) {
  const band = confidenceBand(result.confidence);
  const pct = Math.round(result.confidence * 100);
  const variant = variantLabel(result.matched_variant);
  const assignedCount = Object.keys(result.role_assignments).length;

  return (
    <article
      className={`template-match-row template-match-row-${band}`}
      data-template-id={result.template_id}
    >
      <header className="template-match-row-head">
        <span className="template-match-name">{result.template_name}</span>
        <span className={`template-match-band template-match-band-${band}`}>
          {confidenceLabel(result.confidence)} · {pct}%
        </span>
      </header>
      <div className="template-match-bar-track">
        <div
          className={`template-match-bar-fill template-match-bar-fill-${band}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="template-match-meta">
        {variant ? (
          <span className="template-match-tag">变体：{variant}</span>
        ) : null}
        {assignedCount > 0 ? (
          <span className="template-match-tag">
            已匹配 {assignedCount} 个角色
          </span>
        ) : null}
        {result.reference_id ? (
          <span className="template-match-tag template-match-tag-muted">
            ref: <code>{result.reference_id}</code>
          </span>
        ) : null}
      </div>
      {assignedCount > 0 ? (
        <details className="template-match-roles">
          <summary>展开角色分配</summary>
          <ul>
            {Object.entries(result.role_assignments).map(([studentId, role]) => (
              <li key={studentId}>
                <code>{studentId.replace(/^cur_comp:/, "")}</code>
                {" → "}
                <strong>{role}</strong>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {result.missing_required.length > 0 ? (
        <p className="template-match-missing">
          缺必需：
          {result.missing_required.map((role) => (
            <code key={role} className="template-match-missing-tag">
              {role}
            </code>
          ))}
        </p>
      ) : null}
      {result.missing_optional.length > 0 ? (
        <p className="template-match-missing template-match-missing-optional">
          缺可选：
          {result.missing_optional.map((role) => (
            <code key={role} className="template-match-missing-tag">
              {role}
            </code>
          ))}
        </p>
      ) : null}
      {result.forbidden_violations.length > 0 ? (
        <p className="template-match-forbidden">
          违反 {result.forbidden_violations.length} 项 forbidden 约束
        </p>
      ) : null}
    </article>
  );
}

export function TemplateMatchPanel({ templateMatch }: Props) {
  if (!templateMatch || templateMatch.top_k.length === 0) {
    return null;
  }

  // Filter out 0-confidence rows — they pollute the display without value.
  const visible = templateMatch.top_k.filter((r) => r.confidence > 0);
  const allZero = visible.length === 0;

  return (
    <section className="template-match-panel">
      <header className="template-match-head">
        <h2>
          <Sparkles size={18} />
          AI 拓扑识别
        </h2>
        <span className="template-match-badge">Phase 0 · 实验功能</span>
      </header>
      <p className="muted">
        模板匹配器并行运行了 6 个 canonical 拓扑模板，下方按置信度排序展示 top
        {templateMatch.top_k.length} 个假设。本面板仅作展示，不影响主诊断结果。
      </p>
      {allZero ? (
        <p className="muted template-match-empty">
          当前电路与已注册的 6 个 canonical 拓扑都不匹配，可能是新的拓扑或视觉识别有误。
        </p>
      ) : (
        <div className="template-match-list">
          {visible.map((result) => (
            <MatchRow key={result.template_id} result={result} />
          ))}
        </div>
      )}
    </section>
  );
}
