/**
 * TopologySuggestionBanner — CADx Phase 1 AI 推荐入口
 *
 * Renders the top-3 hypotheses from GNN-A above the manual reference
 * dropdown. Each row has a "采用此识别" button that calls back into the
 * parent (DemoPage) to auto-select the corresponding reference.
 *
 * Design choices:
 *   - **Top-3** because confidence falls off a cliff after rank 3 in
 *     practice (most circuits have one or two plausible hypotheses).
 *   - **Auto-recommend only when confidence band is "high"** — for
 *     medium/low we show the panel but don't auto-select.
 *   - **Divergence banner** when the currently-selected reference !=
 *     AI top-1 — this is the demo killer feature ("AI thinks you should
 *     compare against X, not Y").
 *   - Disabled-reason rendering mirrors the GnnAdvisoryPanel pattern
 *     so the UX vocabulary stays consistent.
 */

import { Bot, Check, RefreshCw, X } from "lucide-react";
import type {
  TopologyPrediction,
  TopologySuggestResponse,
} from "../types/topology";

type Props = {
  /** null when not yet fetched; populated after pipeline produces netlist_v2. */
  suggestion: TopologySuggestResponse | null;
  /** True while a fetch is in flight. */
  loading: boolean;
  /** Network / API error (string), or null. */
  error: string | null;
  /** Whatever reference the user / system currently has selected. */
  selectedReferenceId: string | null;
  /** Callback: user clicked "采用此识别" on a hypothesis row. */
  onAdopt: (referenceId: string) => void;
  /** Callback: user clicked "重新识别" to retry the fetch manually. */
  onRetry: () => void;
};

const BAND_LABEL: Record<string, { text: string; tone: string }> = {
  high:          { text: "高置信",   tone: "high" },
  medium:        { text: "中等置信", tone: "mid" },
  low:           { text: "低置信",   tone: "low" },
  disagreement: { text: "AI 内部分歧", tone: "warn" },
};

const DISABLED_REASON_TEXT: Record<string, string> = {
  checkpoint_missing: "后端 GNN-A 模型未加载（缺 ckpt）",
  runtime_unavailable: "GNN 运行时不可用（缺 torch/pyg）",
  model_failed: "模型推理失败",
  tiny_graph: "电路图太小，AI 无法识别",
};

function reasonText(reason: string | null | undefined): string {
  if (!reason) return "AI 未运行";
  return DISABLED_REASON_TEXT[reason] ?? reason;
}

function confidenceClass(confidence: number): "high" | "mid" | "low" {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.5) return "mid";
  return "low";
}

/** One hypothesis row with confidence bar + adopt button. */
function HypothesisRow({
  prediction,
  isSelected,
  onAdopt,
}: {
  prediction: TopologyPrediction;
  isSelected: boolean;
  onAdopt: (referenceId: string) => void;
}) {
  const band = confidenceClass(prediction.confidence);
  const pct = Math.round(prediction.confidence * 100);
  const canAdopt = prediction.reference_id !== null;

  return (
    <article
      className={`topology-suggestion-row topology-suggestion-row-${band} ${
        isSelected ? "topology-suggestion-row-selected" : ""
      }`}
      data-label={prediction.label}
    >
      <header className="topology-suggestion-row-head">
        <span className="topology-suggestion-rank">#{prediction.rank}</span>
        <span className="topology-suggestion-name">
          {prediction.display_name_zh}
        </span>
        <span className={`topology-suggestion-pct topology-suggestion-pct-${band}`}>
          {pct}%
        </span>
        {canAdopt ? (
          <button
            type="button"
            className={`topology-suggestion-adopt ${
              isSelected ? "topology-suggestion-adopt-current" : ""
            }`}
            onClick={() => onAdopt(prediction.reference_id!)}
            disabled={isSelected}
            title={
              isSelected
                ? "当前已选中此参考"
                : `把参考电路切换为 ${prediction.reference_id}`
            }
          >
            {isSelected ? (
              <>
                <Check size={12} /> 当前选中
              </>
            ) : (
              "采用"
            )}
          </button>
        ) : (
          <span className="topology-suggestion-no-ref" title="无对应参考电路">
            —
          </span>
        )}
      </header>
      <div className="topology-suggestion-bar-track">
        <div
          className={`topology-suggestion-bar-fill topology-suggestion-bar-fill-${band}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {prediction.reference_id ? (
        <code className="topology-suggestion-ref-id">{prediction.reference_id}</code>
      ) : null}
    </article>
  );
}

function ConsensusBanner({
  suggestion,
  selectedReferenceId,
}: {
  suggestion: TopologySuggestResponse;
  selectedReferenceId: string | null;
}) {
  const consensus = suggestion.consensus;
  if (!consensus) return null;
  const band = BAND_LABEL[consensus.confidence_band] ?? BAND_LABEL.medium;

  // Divergence: user picked a different ref than the AI's recommendation.
  const recommendedRef = consensus.recommended_reference_id;
  const diverged =
    recommendedRef !== null &&
    selectedReferenceId !== null &&
    selectedReferenceId !== recommendedRef;

  if (diverged) {
    const topPrediction = suggestion.gnn_predictions[0];
    // An enabled+diverged consensus can still carry an empty prediction list;
    // fall through to the non-divergence banner instead of dereferencing undefined.
    if (!topPrediction) return null;
    return (
      <div className="topology-suggestion-banner topology-suggestion-banner-divergence">
        <X size={14} />
        <span>
          您当前选择的参考电路与 AI 识别结果（
          <strong>{topPrediction.display_name_zh}</strong> ·{" "}
          {Math.round(topPrediction.confidence * 100)}%）不一致。
          建议核对 — AI 认为这块电路更接近{" "}
          <code>{recommendedRef}</code>。
        </span>
      </div>
    );
  }

  return (
    <div className={`topology-suggestion-banner topology-suggestion-banner-${band.tone}`}>
      <Bot size={14} />
      <span>
        AI 识别结果：{band.text}
        {consensus.agreed ? "（GNN 与符号模板一致）" : ""}
      </span>
    </div>
  );
}

export function TopologySuggestionBanner({
  suggestion,
  loading,
  error,
  selectedReferenceId,
  onAdopt,
  onRetry,
}: Props) {
  // ---------- Loading ----------
  if (loading) {
    return (
      <section className="topology-suggestion-panel">
        <header className="topology-suggestion-head">
          <h3>
            <Bot size={14} /> AI 拓扑识别
          </h3>
        </header>
        <p className="muted topology-suggestion-loading">
          <RefreshCw size={12} className="topology-suggestion-spin" /> AI 正在识别拓扑...
        </p>
      </section>
    );
  }

  // ---------- Error ----------
  if (error) {
    return (
      <section className="topology-suggestion-panel">
        <header className="topology-suggestion-head">
          <h3>
            <Bot size={14} /> AI 拓扑识别
          </h3>
          <button
            type="button"
            className="topology-suggestion-retry"
            onClick={onRetry}
          >
            <RefreshCw size={12} /> 重试
          </button>
        </header>
        <p className="error-text topology-suggestion-error">
          AI 识别请求失败：{error}
        </p>
      </section>
    );
  }

  // ---------- Not yet fetched (idle) ----------
  if (suggestion === null) {
    return null; // hidden until first fetch
  }

  // ---------- Disabled (model unavailable / tiny graph) ----------
  if (!suggestion.enabled) {
    return (
      <section className="topology-suggestion-panel">
        <header className="topology-suggestion-head">
          <h3>
            <Bot size={14} /> AI 拓扑识别
          </h3>
        </header>
        <p className="muted topology-suggestion-disabled">
          {reasonText(suggestion.disabled_reason)}
          {suggestion.disabled_reason ? (
            <code className="topology-suggestion-reason-code">
              {suggestion.disabled_reason}
            </code>
          ) : null}
        </p>
      </section>
    );
  }

  // ---------- Happy path ----------
  const top3 = suggestion.gnn_predictions.slice(0, 3).filter((p) => p.confidence > 0.01);
  return (
    <section className="topology-suggestion-panel">
      <header className="topology-suggestion-head">
        <h3>
          <Bot size={14} /> AI 拓扑识别
        </h3>
        <span className="topology-suggestion-meta">
          {suggestion.inference_ms.toFixed(1)}ms ·{" "}
          {suggestion.graph_stats.num_comp_nodes} 元件 ·{" "}
          {suggestion.graph_stats.num_net_nodes} 网络
        </span>
      </header>

      <ConsensusBanner
        suggestion={suggestion}
        selectedReferenceId={selectedReferenceId}
      />

      <div className="topology-suggestion-list">
        {top3.map((p) => (
          <HypothesisRow
            key={p.label}
            prediction={p}
            isSelected={p.reference_id === selectedReferenceId}
            onAdopt={onAdopt}
          />
        ))}
      </div>

      <p className="muted topology-suggestion-footer">
        AI 自动识别基于训练好的 GNN 模型 + 6 个符号模板交叉验证。
        若识别错误请用下方手动选择覆盖。
      </p>
    </section>
  );
}
