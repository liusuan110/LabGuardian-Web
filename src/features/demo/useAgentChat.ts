import { useCallback, useEffect, useRef } from "react";
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

function getStageData(result: PipelineResult, stage: string) {
  return result.stages.find((item) => item.stage === stage)?.data ?? {};
}

function buildDiagnosisContext(
  result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null,
) {
  if (!result) return {};

  const pipelineResult = result as PipelineResult;
  const topology = getStageData(pipelineResult, "topology");
  const validate = getStageData(pipelineResult, "validate");
  const semantic = getStageData(pipelineResult, "semantic_analysis");
  const comparisonReport = pipelineResult.comparison_report ?? validate.comparison_report ?? {};
  return {
    job_id: pipelineResult.job_id ?? "",
    risk_level: pipelineResult.risk_level ?? "unknown",
    component_count: pipelineResult.component_count ?? 0,
    net_count: pipelineResult.net_count ?? 0,
    progress: pipelineResult.progress ?? 0,
    similarity: pipelineResult.similarity ?? 0,
    diagnostics: pipelineResult.diagnostics ?? [],
    risk_reasons: pipelineResult.risk_reasons ?? [],
    comparison_report: comparisonReport,
    validator_report_v2: comparisonReport,
    netlist_v2: topology.netlist_v2 ?? {},
    topology_graph: topology.topology_graph ?? {},
    circuit_snapshot: topology.circuit_description ?? semantic.student_hint ?? "",
    circuit_type_guess: semantic.circuit_type_guess ?? {},
    matched_template: semantic.matched_template ?? {},
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
  // Active timer ids (progress setTimeouts + the streaming setInterval) plus a
  // generation token. Uploading a 2nd image changes `state.imageUrl`, which
  // fires the cleanup effect below: it bumps the generation and tears down any
  // in-flight stream. Combined with the `isStale()` guards in `send()`, this
  // guarantees a previous image's agent run can never dispatch into the
  // freshly-reset store — the root cause of the second-upload crash.
  const timersRef = useRef<number[]>([]);
  const generationRef = useRef(0);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => {
      window.clearTimeout(id);
      window.clearInterval(id);
    });
    timersRef.current = [];
  }, []);

  useEffect(() => {
    // A new upload (imageUrl identity change) or unmount invalidates in-flight work.
    generationRef.current += 1;
    clearTimers();
    return () => {
      generationRef.current += 1;
      clearTimers();
    };
  }, [state.imageUrl, clearTimers]);

  async function send(prompt: string, resultOverride?: PipelineResult) {
    const trimmed = prompt.trim();
    if (!trimmed || state.agentStatus === "running") return;

    const myGeneration = generationRef.current;
    const isStale = () => generationRef.current !== myGeneration;

    const contextResult = resultOverride ?? state.pipelineResult;
    // Agent is now boot-ready. If no pipeline has run yet we synthesize a
    // session-scoped job_id so the backend can track the conversation; the
    // diagnosis_context will be empty and the backend will route through
    // concept_tutor / lab_guidance branches (RAG over local KB).
    const jobId =
      extractJobId(contextResult) ||
      `chat-session-${state.stationId}-${createClientId()}`;

    const placeholderId = createClientId();
    dispatch({ type: "agent-start", prompt: trimmed, placeholderId });

    const progressTimers = PROGRESS_TIMINGS.map(({ phase, at }) =>
      window.setTimeout(() => {
        if (isStale()) return;
        dispatch({ type: "agent-progress", phase });
      }, at),
    );
    timersRef.current.push(...progressTimers);
    const clearProgressTimers = () => progressTimers.forEach((id) => window.clearTimeout(id));

    try {
      const accepted = await askAgent({
        job_id: jobId,
        station_id: state.stationId,
        query: trimmed,
        user_message: trimmed,
        mode: "agent_auto",
        top_k: 5,
        chat_history: buildChatHistory(state.chatMessages),
        diagnosis_context: buildDiagnosisContext(contextResult),
        locale: "zh-CN",
      });
      // Pass the staleness check so polling stops promptly once a new upload
      // has invalidated this run, instead of hammering the backend for ~108s.
      const agentResult = await waitForAgentResult(accepted.job_id, isStale);
      clearProgressTimers();

      // A newer upload/run invalidated us while awaiting — drop the result so
      // it can't land in the reset store as a phantom "thinking" bubble.
      if (isStale()) return;

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
          if (isStale()) {
            window.clearInterval(interval);
            resolve();
            return;
          }
          written += STREAM_CHARS_PER_TICK;
          if (written >= fullAnswer.length) {
            window.clearInterval(interval);
            dispatch({ type: "chat-stream-done", messageId: placeholderId });
            resolve();
          } else {
            dispatch({ type: "chat-stream-tick", messageId: placeholderId, chars: STREAM_CHARS_PER_TICK });
          }
        }, STREAM_INTERVAL_MS);
        timersRef.current.push(interval);
      });
    } catch (error) {
      clearProgressTimers();
      if (isStale()) return;
      dispatch({
        type: "agent-error",
        error: error instanceof Error ? error.message : "Agent 诊断失败",
      });
    }
  }

  return { send };
}
