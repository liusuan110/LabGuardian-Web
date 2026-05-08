export type AgentJobState = "pending" | "running" | "completed" | "failed";

export type AgentChatHistoryItem = {
  role: string;
  content: string;
};

export type AgentAskRequest = {
  job_id?: string;
  station_id: string;
  query: string;
  user_message?: string;
  mode: "diagnose" | "rag" | "diagnostic_agent" | string;
  top_k: number;
  chat_history?: AgentChatHistoryItem[];
  diagnosis_context?: Record<string, unknown>;
  locale?: string;
};

export type AgentAcceptedResponse = {
  job_id: string;
  status: AgentJobState;
};

export type AgentCitation = {
  source_type: string;
  source_id: string;
  title: string;
  snippet: string;
};

export type AgentEvidence = {
  evidence_type: string;
  source_id: string;
  summary: string;
  payload: Record<string, unknown>;
};

export type AgentAction = {
  action_type: string;
  label: string;
  detail: string;
};

export type AgentJobResult = {
  job_id: string;
  station_id: string;
  mode: string;
  answer: string;
  follow_up_suggestions?: string[];
  citations: AgentCitation[];
  evidence: AgentEvidence[];
  actions: AgentAction[];
  used_retrieval: boolean;
  created_at: number;
  debug?: Record<string, unknown> | null;
};

export type AgentStatusResponse = {
  job_id: string;
  status: AgentJobState;
  result: AgentJobResult | null;
  error: string | null;
};

export type AgentProgressPhase = "retrieving" | "reasoning" | "composing";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  status?: "sending" | "streaming" | "sent" | "error";
  phase?: AgentProgressPhase;
  pendingAnswer?: string;
  streamedContent?: string;
  actions?: AgentAction[];
  citations?: AgentCitation[];
  evidence?: AgentEvidence[];
  followUps?: string[];
};
