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

type ReportBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] }
  | { type: "callout"; variant: "safety" | "source" | "note"; text: string };

const SECTION_HEADINGS = new Set([
  "结论",
  "依据",
  "建议",
  "具体建议",
  "接线建议",
  "追问建议",
  "引导追问",
  "安全提醒",
  "知识来源",
  "引用",
]);

function cleanInlineMarkdown(text: string) {
  return text.replace(/\*\*/g, "").replace(/^[-*]\s+/, "").trim();
}

function splitHeading(line: string): { heading: string; rest: string } | null {
  const match = line.match(/^([\u4e00-\u9fa5A-Za-z /_-]{2,12})[:：]\s*(.*)$/);
  if (!match) return null;
  const heading = match[1].trim();
  if (!SECTION_HEADINGS.has(heading)) return null;
  return { heading, rest: match[2].trim() };
}

function parseReportBlocks(text: string): ReportBlock[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const blocks: ReportBlock[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ type: "list", items: listItems });
      listItems = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const heading = splitHeading(line);
    if (heading) {
      flushList();
      if (heading.heading === "安全提醒") {
        blocks.push({ type: "callout", variant: "safety", text: heading.rest || line });
      } else if (heading.heading === "知识来源" || heading.heading === "引用") {
        blocks.push({ type: "callout", variant: "source", text: heading.rest || line });
      } else {
        blocks.push({ type: "heading", text: heading.heading });
        if (heading.rest) {
          blocks.push({ type: "paragraph", text: heading.rest });
        }
      }
      continue;
    }

    const listMatch = line.match(/^(\d+[.)、]|[-*])\s*(.+)$/);
    if (listMatch) {
      listItems.push(cleanInlineMarkdown(listMatch[2]));
      continue;
    }

    if (/^(安全提醒|知识来源|引用)[:：]/.test(line)) {
      flushList();
      blocks.push({
        type: line.startsWith("安全提醒") ? "callout" : "callout",
        variant: line.startsWith("安全提醒") ? "safety" : "source",
        text: line.replace(/^(安全提醒|知识来源|引用)[:：]\s*/, ""),
      });
      continue;
    }

    flushList();
    blocks.push({ type: "paragraph", text: cleanInlineMarkdown(line) });
  }
  flushList();
  return blocks;
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    return <span key={idx}>{part}</span>;
  });
}

function AgentAnswerText({ text, streaming }: { text: string; streaming: boolean }) {
  if (streaming) {
    return (
      <p className="chat-text streaming">
        {text}
        <span className="chat-caret" />
      </p>
    );
  }
  const blocks = parseReportBlocks(text);
  if (blocks.length <= 1) {
    return <p className="chat-text">{text}</p>;
  }
  return (
    <div className="agent-report">
      {blocks.map((block, idx) => {
        if (block.type === "heading") {
          return (
            <h3 className="agent-report-heading" key={`${block.type}-${idx}`}>
              {block.text}
            </h3>
          );
        }
        if (block.type === "list") {
          return (
            <ol className="agent-report-list" key={`${block.type}-${idx}`}>
              {block.items.map((item, itemIdx) => (
                <li key={`${idx}-${itemIdx}`}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }
        if (block.type === "callout") {
          return (
            <div className={`agent-report-callout ${block.variant}`} key={`${block.type}-${idx}`}>
              {renderInline(block.text)}
            </div>
          );
        }
        return (
          <p className="agent-report-paragraph" key={`${block.type}-${idx}`}>
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}

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
                  isAssistant ? (
                    <AgentAnswerText text={displayText} streaming={isStreaming} />
                  ) : (
                    <p className="chat-text">{displayText}</p>
                  )
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
