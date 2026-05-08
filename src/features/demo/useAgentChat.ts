import { askAgent, waitForAgentResult } from "../../api/agent";
import type { ChatMessage } from "../../types/agent";
import type { PipelineResult, CircuitAnalysisResult, PortVisualizationResult } from "../../types/pipeline";
import { createClientId } from "../../utils/id";
import type { DemoAction, DemoState } from "./demoReducer";

function extractJobId(result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null): string {
  if (!result) return "";
  if ("job_id" in result && result.job_id) {
    return String(result.job_id);
  }
  return "";
}

function buildDiagnosisContext(
  result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null,
) {
  if (!result) return {};

  const isCircuitAnalysis = "components" in result && !("similarity" in result);

  if (isCircuitAnalysis) {
    const circuitResult = result as CircuitAnalysisResult;
    return {
      job_id: circuitResult.job_id ?? "",
      component_count: circuitResult.component_count ?? 0,
      net_count: circuitResult.net_count ?? 0,
      risk_level: "unknown",
      components: circuitResult.components ?? [],
      nets: circuitResult.nets ?? [],
      circuit_description: circuitResult.circuit_description ?? "",
    };
  }

  const pipelineResult = result as PipelineResult;
  return {
    job_id: pipelineResult.job_id ?? "",
    risk_level: pipelineResult.risk_level ?? "unknown",
    component_count: pipelineResult.component_count ?? 0,
    net_count: pipelineResult.net_count ?? 0,
    progress: pipelineResult.progress ?? 0,
    similarity: pipelineResult.similarity ?? 0,
    diagnostics: pipelineResult.diagnostics ?? [],
    risk_reasons: pipelineResult.risk_reasons ?? [],
    runtime_metadata: pipelineResult.runtime_metadata ?? {},
  };
}

function buildChatHistory(messages: ChatMessage[]) {
  return messages
    .filter((msg) => msg.status !== "sending" && msg.status !== "streaming" && msg.status !== "error")
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
}

const PROGRESS_TIMINGS: Array<{ phase: "reasoning" | "composing"; at: number }> = [
  { phase: "reasoning", at: 1600 },
  { phase: "composing", at: 3000 },
];

const STREAM_INTERVAL_MS = 25;
const STREAM_CHARS_PER_TICK = 2;

export function useAgentChat(state: DemoState, dispatch: React.Dispatch<DemoAction>) {
  async function send(prompt: string, resultOverride?: PipelineResult) {
    const trimmed = prompt.trim();
    if (!trimmed || state.agentStatus === "running") return;

    const contextResult = resultOverride ?? state.pipelineResult;
    const jobId = extractJobId(contextResult);

    if (!jobId) {
      dispatch({
        type: "agent-error",
        error: "当前没有有效的诊断任务 ID",
      });
      return;
    }

    const placeholderId = createClientId();
    dispatch({ type: "agent-start", prompt: trimmed, placeholderId });

    const progressTimers = PROGRESS_TIMINGS.map(({ phase, at }) =>
      window.setTimeout(() => {
        dispatch({ type: "agent-progress", phase });
      }, at),
    );
    const clearProgressTimers = () => progressTimers.forEach((id) => window.clearTimeout(id));

    try {
      const accepted = await askAgent({
        job_id: jobId,
        station_id: state.stationId,
        query: trimmed,
        user_message: trimmed,
        mode: "diagnostic_agent",
        top_k: 5,
        chat_history: buildChatHistory(state.chatMessages),
        diagnosis_context: buildDiagnosisContext(contextResult),
        locale: "zh-CN",
      });
      const agentResult = await waitForAgentResult(accepted.job_id);
      clearProgressTimers();

      if (agentResult.status === "failed") {
        dispatch({ type: "agent-error", error: agentResult.error || "Agent 诊断失败" });
        return;
      }

      dispatch({ type: "agent-success", result: agentResult });

      const fullAnswer = agentResult.result?.answer ?? "";
      if (!fullAnswer) {
        dispatch({ type: "chat-stream-done", messageId: placeholderId });
        return;
      }

      await new Promise<void>((resolve) => {
        let written = 0;
        const interval = window.setInterval(() => {
          written += STREAM_CHARS_PER_TICK;
          if (written >= fullAnswer.length) {
            window.clearInterval(interval);
            dispatch({ type: "chat-stream-done", messageId: placeholderId });
            resolve();
          } else {
            dispatch({ type: "chat-stream-tick", messageId: placeholderId, chars: STREAM_CHARS_PER_TICK });
          }
        }, STREAM_INTERVAL_MS);
      });
    } catch (error) {
      clearProgressTimers();
      dispatch({
        type: "agent-error",
        error: error instanceof Error ? error.message : "Agent 诊断失败",
      });
    }
  }

  return { send };
}
