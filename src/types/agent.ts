export type AgentJobState = "pending" | "running" | "completed" | "failed";

export type AgentAskRequest = {
  station_id: string;
  query: string;
  mode: "diagnose" | "rag" | "diagnostic_agent" | string;
  top_k: number;
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
  citations: AgentCitation[];
  evidence: AgentEvidence[];
  actions: AgentAction[];
  used_retrieval: boolean;
  created_at: number;
};

export type AgentStatusResponse = {
  job_id: string;
  status: AgentJobState;
  result: AgentJobResult | null;
  error: string | null;
};
