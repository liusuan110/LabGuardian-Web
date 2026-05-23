import { AlertTriangle, CheckCircle2, ChevronDown, Info, Sparkles, Unplug } from "lucide-react";
import type { GnnAdvice, GnnEdgePrediction, GnnSuggestedTarget } from "../types/pipeline";

type Props = {
  gnn?: GnnAdvice;
  ruleLogicCorrect: boolean;
  /** Reason code from backend when GNN sat out the call.
   *  Mutually exclusive with `gnn`. See backend `_GNN_REASON_*`. */
  gnnDisabledReason?: string;
  /** Did the user pick a reference circuit? When false the entire GNN
   *  pipeline is skipped by the backend — render a clear "needs ref" hint
   *  instead of silently disappearing. */
  hasReference?: boolean;
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

/**
 * 单条 (port, net) 边的 p_correct 置信度条。
 *
 * - p ≥ 0.8 → 绿色（强信号 "AI 确信这条接对了"）
 * - 0.5 ≤ p < 0.8 → 黄色（中等信心）
 * - p < 0.5 → 红色（AI 怀疑这条接错）
 *
 * port 和 net 优先用 `edge_display`（后端 gnn_display.py 注入的中文 role
 * 友好名 —— "INV (反相输入)" 等），缺失则回退到 source_id 截前缀。
 */
function EdgeConfidenceRow({ edge }: { edge: GnnEdgePrediction }) {
  const p = edge.p_correct;
  const pct100 = Math.round(Math.max(0, Math.min(1, p)) * 100);
  const colorClass = p >= 0.8 ? "high" : p >= 0.5 ? "mid" : "low";
  const portLabel = edge.edge_display?.[0] ?? (() => {
    const { component, pin } = stripPort(edge.edge[0]);
    return pin ? `${component} · ${pin}` : component;
  })();
  const netLabel = edge.edge_display?.[1] ?? stripNet(edge.edge[1]);
  return (
    <li className="gnn-edge-row">
      <div className="gnn-edge-label">
        <code>{portLabel}</code>
        <span className="gnn-arrow">→</span>
        <code>{netLabel}</code>
      </div>
      <div className="gnn-edge-bar-wrap" aria-label={`置信度 ${pct100}%`}>
        <div className="gnn-edge-bar-track">
          <div
            className={`gnn-edge-bar-fill gnn-edge-bar-${colorClass}`}
            style={{ width: `${pct100}%` }}
          />
        </div>
        <span className={`gnn-edge-pct gnn-edge-pct-${colorClass}`}>{pct100}%</span>
      </div>
    </li>
  );
}

/**
 * `edge_predictions` 列表是 AI 对每条已接边的逐条评分。在新版面板
 * 里始终可折叠展开 —— 帮用户感知到"AI 真的在看每条线"，而不是
 * 一个不透明的黑盒判定。
 */
function EdgePredictionsList({ edges }: { edges: GnnEdgePrediction[] }) {
  if (edges.length === 0) return null;
  // 排序：最低置信度的先显示（user-facing：先看可疑边）
  const sorted = [...edges].sort((a, b) => a.p_correct - b.p_correct);
  return (
    <details className="gnn-edge-predictions">
      <summary>
        <ChevronDown size={12} />
        <span>查看每条边的 AI 打分（{edges.length} 条）</span>
      </summary>
      <ul className="gnn-edge-list">
        {sorted.map((e, i) => (
          <EdgeConfidenceRow key={`${e.edge[0]}-${e.edge[1]}-${i}`} edge={e} />
        ))}
      </ul>
    </details>
  );
}

function GnnFooter({ gnn }: { gnn: GnnAdvice }) {
  return (
    <p className="gnn-advisory-footer">
      模型 {gnn.model_version ?? "—"} · 评估 {gnn.n_edges_scored ?? 0} 条已接边、
      {gnn.n_suggestion_candidates_scored ?? 0} 条候选 · 耗时{" "}
      {typeof gnn.inference_ms === "number" ? `${Math.round(gnn.inference_ms)} ms` : "—"}
    </p>
  );
}

export function GnnAdvisoryPanel({ gnn, ruleLogicCorrect, gnnDisabledReason, hasReference }: Props) {
  // 缺席状态：没有 advice 数据
  // 三种"GNN 没跑"的诊断信号，按优先级：
  //   1. 用户没选 reference  → 提示"选 ref 才能启用 AI 复核"
  //   2. 后端写了 disabled_reason → 用映射的人话渲染
  //   3. 啥也没有 → 静默隐藏（理论上不会发生：选了 ref 且后端正常时
  //      gnn 或 gnn_disabled_reason 必有其一）
  if (!gnn) {
    if (hasReference === false) {
      return (
        <p className="gnn-absent-notice" aria-label="未选择参考电路">
          <Info size={14} />
          <span>
            未选择参考电路 —— AI 复核（GNN 模型）不会启用。请在右侧选一个
            参考电路再重新运行，即可看到每条连接的置信度评分。
          </span>
        </p>
      );
    }
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
  const suggestions = gnn.suggested_targets ?? [];
  const edgePredictions = gnn.edge_predictions ?? [];

  // 关键设计修正 (2026-05-21):
  // 旧版用 `ruleLogicCorrect` 当渲染门 —— 规则报错时直接 return null，
  // 导致 v5 最有价值的"AI 抓出具体哪条线错"被藏掉。
  // 新版：渲染条件完全独立于规则结果，只看 GNN 自己的信号：
  //   - 有 suspect edge / floating REQUIRED → 警告模式
  //   - GNN 跑了但都过关 → 成功模式
  // 警告横幅的文案根据规则结果分两种话术。
  const hasSuggestions = suggestions.length > 0;
  const hasGnnDisagreement = gnn.disagreement_with_rule === true;
  const lowConfidenceEdges = edgePredictions.filter((e) => e.p_correct < 0.5);
  const hasIssues = hasSuggestions || hasGnnDisagreement || lowConfidenceEdges.length > 0;

  const wrongCount = suggestions.filter((t) => t.reason === "likely_wrong").length;
  const floatingCount = suggestions.filter(isFloating).length;
  const confidence = pct(gnn.graph_similarity_confidence);

  // 成功模式：GNN 没标出任何可疑边 / 浮空。规则结论独立——可能规则通过 (双重确认)，
  // 也可能规则因为缺组件等"组件级"问题报错但 GNN 看每条边都合理。
  if (!hasIssues) {
    const meanP =
      edgePredictions.length > 0
        ? edgePredictions.reduce((s, e) => s + e.p_correct, 0) / edgePredictions.length
        : null;
    const minP =
      edgePredictions.length > 0
        ? Math.min(...edgePredictions.map((e) => e.p_correct))
        : null;
    const flagged = lowConfidenceEdges.length;
    const successCopy = ruleLogicCorrect
      ? "规则比较器与 AI 模型都判定本次连接正确。"
      : "AI 模型对每条连接的评估均通过，规则比较器报的错可能在组件层（缺/多元件）而非接线层。";
    return (
      <section className="gnn-advisory gnn-advisory-success" aria-label="AI 复核通过">
        <header className="gnn-advisory-banner gnn-advisory-banner-success">
          <CheckCircle2 size={18} />
          <div>
            <strong>AI 复核通过</strong>
            <p>
              {edgePredictions.length > 0 ? (
                <>
                  {successCopy} 评估了 {edgePredictions.length} 条连接，
                  {flagged === 0 ? "全部判定为正确" : `其中 ${flagged} 条置信度偏低`}
                  ，平均置信度 <strong>{pct(meanP)}</strong>
                  {minP !== null ? `（最低 ${pct(minP)}）` : ""}。
                </>
              ) : (
                "AI 已完成本次复核，但未给出可视化的逐边评分。"
              )}
            </p>
          </div>
          <span className="gnn-advisory-conf" title="模型置信度（基于预测分散度）">
            {confidence}
          </span>
        </header>
        <EdgePredictionsList edges={edgePredictions} />
        <GnnFooter gnn={gnn} />
      </section>
    );
  }

  // 警告横幅文案：根据规则结果分两种话术。
  // - 规则 OK + GNN 怀疑   → "规则认为通过，但 AI 模型识别出..."（互补 + 信任规则）
  // - 规则 wrong + GNN 怀疑 → "AI 模型识别出..."（与规则同方向，AI 给出更细的边级定位）
  const lowConfCount = lowConfidenceEdges.length;
  const headerCopy = ruleLogicCorrect ? (
    <>
      规则比较器认为电路通过，但 AI 模型识别出
      {wrongCount > 0 ? ` ${wrongCount} 处可疑接线` : ""}
      {wrongCount > 0 && floatingCount > 0 ? "，" : ""}
      {floatingCount > 0 ? `${floatingCount} 处未接线` : ""}
      {(wrongCount > 0 || floatingCount > 0) && lowConfCount > 0 ? "，" : ""}
      {lowConfCount > 0 ? `${lowConfCount} 条置信度低于 50%` : ""}
      。最终判定仍以规则为准，请人工复核下方建议。
    </>
  ) : (
    <>
      AI 模型在已识别的连接中定位到
      {wrongCount > 0 ? ` ${wrongCount} 处可疑接线` : ""}
      {wrongCount > 0 && floatingCount > 0 ? "，" : ""}
      {floatingCount > 0 ? `${floatingCount} 处未接线` : ""}
      {(wrongCount > 0 || floatingCount > 0) && lowConfCount > 0 ? "，" : ""}
      {lowConfCount > 0 ? `${lowConfCount} 条置信度低于 50%` : ""}
      。规则比较器已独立报错，AI 的建议供进一步定位参考。
    </>
  );

  return (
    <section className="gnn-advisory" aria-label="GNN 复核提示">
      <header className="gnn-advisory-banner">
        <Sparkles size={18} />
        <div>
          <strong>GNN 复核提示</strong>
          <p>{headerCopy}</p>
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

      {/* 警告模式下也展开每条边的逐条评分 —— 让用户看清楚 "AI 担心
          这条" 和 "AI 觉得这条没问题" 的对比，避免只看到红色卡片。 */}
      <EdgePredictionsList edges={edgePredictions} />

      <GnnFooter gnn={gnn} />
    </section>
  );
}
