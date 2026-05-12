import { Bot, BookOpen, FileSearch, SendHorizontal, Sparkles, UserRound, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../types/agent";
import { AgentEvidencePanel } from "./AgentEvidencePanel";

type Props = {
  messages: ChatMessage[];
  status: "idle" | "running" | "success" | "error";
  canSend: boolean;
  onSend: (message: string) => Promise<void>;
  modelLabel?: string;
};

export function AgentChat({ messages, status, canSend, onSend, modelLabel = "" }: Props) {
  const [draft, setDraft] = useState("");
  const isRunning = status === "running";
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, status]);

  async function submit(text?: string) {
    const value = (text ?? draft).trim();
    if (!value || !canSend || isRunning) return;
    setDraft("");
    await onSend(value);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      void submit();
    }
  }

  return (
    <section className="agent-chat">
      <div className="chat-heading">
        <h2>
          <Bot size={18} />
          上下文诊断对话
        </h2>
        <div className="chat-heading-meta">
          {modelLabel ? <span className="chat-model">{modelLabel}</span> : null}
          <span className="chat-status">
            {isRunning ? (
              <>
                <Loader2 size={14} className="spin" />
                Agent 思考中
              </>
            ) : (
              "可追问"
            )}
          </span>
        </div>
      </div>

      <div className="chat-thread" ref={threadRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            {canSend
              ? "运行完整诊断后，Agent 会自动生成第一轮解释。之后可继续追问。"
              : "请先运行完整诊断"}
          </div>
        )}

        {messages.map((message) => {
          const isStreaming = message.status === "streaming";
          const isPhase = message.status === "sending";
          const isAssistant = message.role === "assistant";
          const showExtras = isAssistant && message.status === "sent";
          const displayText = isStreaming ? message.streamedContent ?? "" : message.content;
          return (
            <article className={`chat-message ${message.role}`} key={message.id}>
              <div className="chat-avatar">
                {message.role === "user" ? <UserRound size={15} /> : <Bot size={15} />}
              </div>
              <div className="chat-bubble">
                {isPhase ? (
                  <div className="chat-typing">
                    <Loader2 size={14} className="spin" />
                    <span>{message.content}</span>
                  </div>
                ) : (
                  <p className={`chat-text ${isStreaming ? "streaming" : ""}`}>
                    {displayText}
                    {isStreaming ? <span className="chat-caret" /> : null}
                  </p>
                )}

                {showExtras && message.citations && message.citations.length > 0 ? (
                  <div className="chat-citations">
                    <div className="chat-extras-label">
                      <BookOpen size={12} />
                      <span>引用来源 ({message.citations.length})</span>
                    </div>
                    <div className="chat-citations-list">
                      {message.citations.map((c, i) => (
                        <span
                          key={`${c.source_id}-${i}`}
                          className="chat-citation-chip"
                          title={c.snippet}
                        >
                          <span className="chat-citation-type">{c.source_type}</span>
                          <span className="chat-citation-title">{c.title || c.source_id}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {showExtras && message.evidence && message.evidence.length > 0 ? (
                  <AgentEvidencePanel evidence={message.evidence} />
                ) : null}

                {showExtras && message.evidence && message.evidence.length > 0 ? (
                  <details className="chat-evidence">
                    <summary>
                      <FileSearch size={12} />
                      <span>展开 {message.evidence.length} 条诊断证据</span>
                    </summary>
                    <ul className="chat-evidence-list">
                      {message.evidence.map((e, i) => (
                        <li key={`${e.source_id}-${i}`}>
                          <span className="chat-evidence-type">{e.evidence_type}</span>
                          <span className="chat-evidence-summary">{e.summary}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}

                {showExtras && message.followUps && message.followUps.length > 0 ? (
                  <div className="chat-followups">
                    <div className="chat-extras-label">
                      <Sparkles size={12} />
                      <span>追问建议</span>
                    </div>
                    <div className="chat-followups-list">
                      {message.followUps.map((q, i) => (
                        <button
                          key={i}
                          type="button"
                          className="chat-followup-btn"
                          disabled={!canSend || isRunning}
                          onClick={() => void submit(q)}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <form
        className="chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <textarea
          className="chat-textarea"
          rows={1}
          value={draft}
          placeholder={canSend ? "继续追问，例如：为什么判断这个引脚悬空？" : "请先运行完整诊断"}
          disabled={!canSend || isRunning}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={!canSend || isRunning || !draft.trim()}
          title="发送"
        >
          <SendHorizontal size={18} />
        </button>
      </form>
    </section>
  );
}
