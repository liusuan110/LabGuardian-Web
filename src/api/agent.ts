import { requestJson } from "./client";
import type { AgentAcceptedResponse, AgentAskRequest, AgentStatusResponse } from "../types/agent";

const POLL_INTERVAL_MS = 900;
const MAX_POLLS = 120;

export async function askAgent(request: AgentAskRequest) {
  return requestJson<AgentAcceptedResponse>("/api/v1/angnt/ask", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function getAgentStatus(jobId: string) {
  return requestJson<AgentStatusResponse>(`/api/v1/angnt/status/${jobId}`, {
    method: "GET",
  });
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function waitForAgentResult(jobId: string) {
  for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
    const status = await getAgentStatus(jobId);
    if (status.status === "completed" || status.status === "failed") {
      return status;
    }
    await wait(POLL_INTERVAL_MS);
  }
  throw new Error("Agent 诊断等待超时。");
}
