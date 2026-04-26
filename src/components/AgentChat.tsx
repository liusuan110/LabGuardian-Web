import { Bot, SendHorizontal, UserRound } from "lucide-react";
import { useState } from "react";
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

  async function submit() {
    const text = draft.trim();
    if (!text || !canSend || isRunning) return;
    setDraft("");
    await onSend(text);
  }

  return (
    <section className="agent-chat">
      <div className="chat-heading">
        <h2>
          <Bot size={18} />
          上下文诊断对话
        </h2>
        <span>{isRunning ? "Agent 思考中" : "可追问"}</span>
      </div>

      <div className="chat-thread">
        {messages.length ? (
          messages.map((message) => (
            <article className={`chat-message ${message.role}`} key={message.id}>
              <div className="chat-avatar">
                {message.role === "user" ? <UserRound size={15} /> : <Bot size={15} />}
              </div>
              <div className="chat-bubble">
                <p>{message.content}</p>
                {message.actions?.length ? (
                  <div className="chat-actions">
                    {message.actions.map((action) => (
                      <span key={`${message.id}-${action.action_type}-${action.label}`}>
                        {action.label}: {action.detail}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="chat-empty">运行完整诊断后，Agent 会自动生成第一轮解释。之后可继续追问。</div>
        )}
        {isRunning ? <div className="chat-empty compact">正在结合 pipeline 和历史对话生成回复...</div> : null}
      </div>

      <form
        className="chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          value={draft}
          placeholder={canSend ? "继续追问，例如：为什么判断这个引脚悬空？" : "请先运行完整诊断"}
          disabled={!canSend || isRunning}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" disabled={!canSend || isRunning || !draft.trim()} title="发送">
          <SendHorizontal size={18} />
        </button>
      </form>
    </section>
  );
}
