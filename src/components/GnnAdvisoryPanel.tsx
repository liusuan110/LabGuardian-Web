import { AlertTriangle, ChevronDown, Info, Sparkles, Unplug } from "lucide-react";
import type { GnnAdvice, GnnSuggestedTarget } from "../types/pipeline";

type Props = {
  gnn?: GnnAdvice;
  ruleLogicCorrect: boolean;
  /** Reason code from backend when GNN sat out the call.
   *  Mutually exclusive with `gnn`. See backend `_GNN_REASON_*`. */
  gnnDisabledReason?: string;
};

const ABSENT_REASON_LABELS: Record<string, string> = {
  runtime_unavailable: "服务器未安装 GNN 运行时（torch / torch_geometric）",
  checkpoint_missing: "未找到 GNN 模型权重文件",
  tiny_circuit: "电路规模小于 8 节点，本次未触发 GNN 复核",
  trigger_predicate_skipped: "规则路径已独立判定本次场景，无需 GNN 介入",
  model_failed: "GNN 推理失败，已回退到规则结果（请检查服务端日志）",
};

function absentReasonText(code: string): string {
  return ABSENT_REASON_LABELS[code] ?? `GNN 未运行（${code}）`;
}

function stripPort(id: string): { component: string; pin: string } {
  const stripped = id.replace(/^cur_port:/, "").replace(/^ref_port:/, "");
  const dot = stripped.indexOf(".");
  if (dot < 0) return { component: stripped, pin: "" };
  return {
    component: stripped.slice(0, dot),
    pin: stripped.slice(dot + 1),
  };
}

function stripNet(id: string): string {
  return id.replace(/^cur_net:/, "").replace(/^ref_net:/, "");
}

function pct(p: number | undefined | null): string {
  if (typeof p !== "number" || Number.isNaN(p)) return "—";
  return `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
}

function isFloating(t: GnnSuggestedTarget): boolean {
  return t.reason === "floating_required";
}

export function GnnAdvisoryPanel({ gnn, ruleLogicCorrect, gnnDisabledReason }: Props) {
  // 缺席状态：没有 advice 数据，但后端写了 disabled_reason → 渲染一行 muted 注脚。
  // 让用户不用翻 JSON 就能知道这次 GNN 为什么没出现。
  if (!gnn) {
    if (gnnDisabledReason) {
      return (
        <p className="gnn-absent-notice" aria-label="GNN 缺席原因">
          <Info size={14} />
          <span>GNN 本次未参与：{absentReasonText(gnnDisabledReason)}</span>
          <code className="gnn-absent-code">{gnnDisabledReason}</code>
        </p>
      );
    }
    return null;
  }
  const disagree = gnn.disagreement_with_rule === true && ruleLogicCorrect;
  const suggestions = gnn.suggested_targets ?? [];
  // 只有在"规则说通过 + GNN 不同意"或"有未接的 REQUIRED 引脚"时才展示这个面板。
  // 规则已报错的场景下，GNN 提示通常和规则错误重叠，不再单独展示。
  const showFloatingHints = ruleLogicCorrect && suggestions.some(isFloating);
  if (!disagree && !showFloatingHints) return null;

  const wrongCount = suggestions.filter((t) => t.reason === "likely_wrong").length;
  const floatingCount = suggestions.filter(isFloating).length;
  const confidence = pct(gnn.graph_similarity_confidence);

  return (
    <section className="gnn-advisory" aria-label="GNN 复核提示">
      <header className="gnn-advisory-banner">
        <Sparkles size={18} />
        <div>
          <strong>GNN 复核提示</strong>
          <p>
            规则比较器认为电路通过，但 AI 模型识别出
            {wrongCount > 0 ? ` ${wrongCount} 处可疑接线` : ""}
            {wrongCount > 0 && floatingCount > 0 ? "，" : ""}
            {floatingCount > 0 ? `${floatingCount} 处未接线` : ""}
            。最终判定仍以规则为准，请人工复核下方建议。
          </p>
        </div>
        <span className="gnn-advisory-conf" title="模型置信度（基于预测分散度）">
          置信度 {confidence}
        </span>
      </header>

      {suggestions.length > 0 ? (
        <ul className="gnn-advisory-cards">
          {suggestions.map((entry) => {
            const top = entry.candidates[0];
            const others = entry.candidates.slice(1);
            const floating = isFloating(entry);

            // 优先 display 字段；缺则切前缀回退。display 才是 demo / 演示
            // 现场希望看到的"R2 · pin1 (反相输入)"。
            const portLabel =
              entry.port_display ?? (() => {
                const { component, pin } = stripPort(entry.port);
                return pin ? `${component} · ${pin}` : component;
              })();
            const currentNetLabels =
              entry.current_nets_display ?? entry.current_nets.map(stripNet);
            const topNetLabel = top
              ? top.net_display ?? stripNet(top.net)
              : null;

            return (
              <li
                key={entry.port}
                className={`gnn-card gnn-card-${floating ? "floating" : "wrong"}`}
              >
                <div className="gnn-card-head">
                  {floating ? <Unplug size={16} /> : <AlertTriangle size={16} />}
                  <strong>{portLabel}</strong>
                  <span className="gnn-card-tag">
                    {floating ? "未接线" : "可能错接"}
                  </span>
                </div>

                {!floating && currentNetLabels.length > 0 ? (
                  <p className="gnn-card-current">
                    现接在{" "}
                    {currentNetLabels.map((n, i) => (
                      <span key={`${entry.port}-cur-${i}`}>
                        {i > 0 ? "、" : ""}
                        <code>{n}</code>
                      </span>
                    ))}
                  </p>
                ) : null}

                {top && topNetLabel ? (
                  <p className="gnn-card-suggest">
                    建议{floating ? "连接到" : "改接到"}{" "}
                    <code className="gnn-card-target">{topNetLabel}</code>
                    <span className="gnn-card-pconnect">
                      P(connect) {pct(top.p_connect)}
                    </span>
                  </p>
                ) : (
                  <p className="gnn-card-suggest gnn-card-empty">
                    暂无可靠候选，请人工确认。
                  </p>
                )}

                {others.length > 0 ? (
                  <details className="gnn-card-more">
                    <summary>
                      <ChevronDown size={12} />
                      其他候选（{others.length}）
                    </summary>
                    <ul>
                      {others.map((c) => {
                        const label = c.net_display ?? stripNet(c.net);
                        return (
                          <li key={`${entry.port}-${c.net}`}>
                            <span className="gnn-rank">#{c.rank}</span>
                            <code>{label}</code>
                            <span className="gnn-pct">{pct(c.p_connect)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="gnn-advisory-empty">
          模型未给出具体建议位置，请按 hotspot 高亮人工复核。
        </p>
      )}

      <p className="gnn-advisory-footer">
        模型 {gnn.model_version ?? "—"} · 评估 {gnn.n_edges_scored ?? 0} 条已接边、
        {gnn.n_suggestion_candidates_scored ?? 0} 条候选 · 耗时{" "}
        {typeof gnn.inference_ms === "number" ? `${Math.round(gnn.inference_ms)} ms` : "—"}
      </p>
    </section>
  );
}
