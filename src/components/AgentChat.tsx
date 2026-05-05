import { Bot, SendHorizontal, UserRound, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../types/agent";

type Props = {
  messages: ChatMessage[];
  status: "idle" | "running" | "success" | "error";
  canSend: boolean;
  onSend: (message: string) => Promise<void>;
};

export function AgentChat({ messages, status, canSend, onSend }: Props) {
  const [draft, setDraft] = useState("");
  const isRunning = status === "running";
  const threadRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, status]);

  async function submit() {
    const text = draft.trim();
    if (!text || !canSend || isRunning) return;
    setDraft("");
    await onSend(text);
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

      <div className="chat-thread" ref={threadRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            {canSend
              ? "运行完整诊断后，Agent 会自动生成第一轮解释。之后可继续追问。"
              : "请先运行完整诊断"}
          </div>
        )}

        {messages.map((message) => (
          <article className={`chat-message ${message.role}`} key={message.id}>
            <div className="chat-avatar">
              {message.role === "user" ? <UserRound size={15} /> : <Bot size={15} />}
            </div>
            <div className="chat-bubble">
              {message.status === "sending" ? (
                <div className="chat-typing">
                  <Loader2 size={14} className="spin" />
                  <span>正在结合诊断上下文生成回复...</span>
                </div>
              ) : (
                <p className="chat-text">{message.content}</p>
              )}
            </div>
          </article>
        ))}
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
