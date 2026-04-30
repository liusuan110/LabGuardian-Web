import { askAgent, waitForAgentResult } from "../../api/agent";
import type { ChatMessage } from "../../types/agent";
import type { PipelineResult, CircuitAnalysisResult, PortVisualizationResult } from "../../types/pipeline";
import { formatDuration, getMappedComponents, getNetCount } from "../../utils/pipeline";
import type { DemoAction, DemoState } from "./demoReducer";

function summarizePipeline(result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null) {
  if (!result) {
    return "当前还没有 pipeline 结果。";
  }

  const isCircuitAnalysis = "components" in result;
  
  if (isCircuitAnalysis) {
    const circuitResult = result as CircuitAnalysisResult;
    const components = circuitResult.components
      .slice(0, 8)
      .map((component) => {
        const pins = component.pins
          .map((pin) => `${pin.pin_name}=${pin.hole_id}(${pin.electrical_node_id ?? "-"})`)
          .join(", ");
        return `${component.component_id} ${component.component_type}: ${pins}`;
      })
      .join("\n");

    return [
      `job_id=${circuitResult.job_id}`,
      `component_count=${circuitResult.component_count}`,
      `net_count=${circuitResult.net_count}`,
      `total_duration=${formatDuration(circuitResult.total_duration_ms)}`,
      `circuit_description=${circuitResult.circuit_description}`,
      `components:\n${components || "无"}`,
    ].join("\n");
  }

  const pipelineResult = result as PipelineResult;
  const mappedComponents = getMappedComponents(pipelineResult)
    .slice(0, 8)
    .map((component) => {
      const pins = (component.pins ?? [])
        .map((pin) => `${pin.pin_name ?? "pin"}=${pin.hole_id ?? "-"}(${pin.electrical_node_id ?? "-"})`)
        .join(", ");
      return `${component.component_id ?? "component"} ${component.component_type ?? "UNKNOWN"}: ${pins}`;
    })
    .join("\n");

  return [
    `job_id=${pipelineResult.job_id}`,
    `risk_level=${pipelineResult.risk_level}`,
    `component_count=${pipelineResult.component_count}`,
    `net_count=${getNetCount(pipelineResult)}`,
    `progress=${pipelineResult.progress}`,
    `similarity=${pipelineResult.similarity}`,
    `total_duration=${formatDuration(pipelineResult.total_duration_ms)}`,
    `diagnostics=${(pipelineResult.diagnostics ?? []).slice(0, 8).join("；") || "无"}`,
    `risk_reasons=${(pipelineResult.risk_reasons ?? []).slice(0, 6).join("；") || "无"}`,
    `mapped_components:\n${mappedComponents || "无"}`,
  ].join("\n");
}

function summarizeConversation(messages: ChatMessage[]) {
  return messages
    .slice(-8)
    .map((message) => `${message.role === "user" ? "用户" : "Agent"}：${message.content}`)
    .join("\n");
}

function buildContextualQuery(prompt: string, result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null, messages: ChatMessage[]) {
  return [
    "你是 LabGuardian 演示诊断 Agent。请基于当前 pipeline 事实链回答，不要重新猜测图像事实。",
    "回答要延续最近对话上下文。如果用户问的是追问，要明确承接上一轮。",
    "",
    "【当前 pipeline 摘要】",
    summarizePipeline(result),
    "",
    "【最近对话】",
    summarizeConversation(messages) || "无",
    "",
    "【用户本轮问题】",
    prompt,
  ].join("\n");
}

export function useAgentChat(state: DemoState, dispatch: React.Dispatch<DemoAction>) {
  async function send(prompt: string, resultOverride?: PipelineResult) {
    const trimmed = prompt.trim();
    if (!trimmed || state.agentStatus === "running") return;

    const contextResult = resultOverride ?? state.pipelineResult;
    dispatch({ type: "agent-start", prompt: trimmed });

    try {
      const accepted = await askAgent({
        station_id: state.stationId,
        query: buildContextualQuery(trimmed, contextResult, state.chatMessages),
        mode: "diagnostic_agent",
        top_k: 5,
      });
      const agentResult = await waitForAgentResult(accepted.job_id);
      if (agentResult.status === "failed") {
        dispatch({ type: "agent-error", error: agentResult.error || "Agent 诊断失败" });
      } else {
        dispatch({ type: "agent-success", result: agentResult });
      }
    } catch (error) {
      dispatch({
        type: "agent-error",
        error: error instanceof Error ? error.message : "Agent 诊断失败",
      });
    }
  }

  return { send };
}
