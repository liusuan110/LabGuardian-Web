import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";

type Props = {
  children: ReactNode;
  /** Short label for the boundary, used in the fallback copy (e.g. "电路画布"). */
  label?: string;
  /** Compact inline card (for a single panel) instead of a full-page fallback. */
  compact?: boolean;
};

type State = {
  error: Error | null;
};

/**
 * Catches render-time throws in its subtree so a single failing component
 * degrades to a recoverable card instead of unmounting the whole React tree
 * to a blank screen (the previous "闪退" failure mode).
 *
 * - Top-level: wrap the whole app so any uncaught throw is contained.
 * - Panel-level (compact): wrap a risky panel so only that panel shows the
 *   fallback while the rest of the app keeps working.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep a console trail for debugging; this is the only place the raw
    // stack is surfaced (the user sees a friendly message instead).
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`, error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { label, compact } = this.props;
    const title = label ? `${label}出现问题` : "界面出现问题";

    return (
      <div
        role="alert"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "flex-start",
          padding: compact ? "18px 20px" : "40px 32px",
          margin: compact ? 0 : "40px auto",
          maxWidth: compact ? "100%" : 560,
          border: "1px solid var(--line, #d8e1dd)",
          borderRadius: 12,
          background: "var(--surface, #fff)",
          color: "var(--ink, #17211f)",
          boxShadow: compact ? "none" : "var(--shadow, 0 18px 48px rgba(21,47,42,0.12))",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--danger, #be3144)" }}>
          <AlertTriangle size={compact ? 18 : 22} />
          <strong style={{ fontSize: compact ? 15 : 18 }}>{title}</strong>
        </div>
        <p style={{ margin: 0, color: "var(--muted, #60706b)", fontSize: 14, lineHeight: 1.55 }}>
          {compact
            ? "该模块渲染失败，其它功能仍可继续使用。可点击重试重新加载本模块。"
            : "页面遇到一个未预期的错误。你的其它操作不受影响——可点击下方按钮恢复界面。"}
        </p>
        {error.message ? (
          <code
            style={{
              fontSize: 12,
              color: "var(--subtle, #80908b)",
              background: "var(--surface-soft, #f6f9f8)",
              border: "1px solid var(--line, #d8e1dd)",
              borderRadius: 6,
              padding: "6px 8px",
              maxWidth: "100%",
              overflowWrap: "anywhere",
            }}
          >
            {error.message}
          </code>
        ) : null}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button
            type="button"
            onClick={this.reset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              background: "var(--accent, #14796b)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            <RotateCcw size={14} /> 重试
          </button>
          {!compact ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid var(--line, #d8e1dd)",
                background: "var(--surface, #fff)",
                color: "var(--ink, #17211f)",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              <RefreshCw size={14} /> 刷新页面
            </button>
          ) : null}
        </div>
      </div>
    );
  }
}
