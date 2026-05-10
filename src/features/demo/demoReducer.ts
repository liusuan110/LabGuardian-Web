import type { AgentAction, AgentProgressPhase, AgentStatusResponse, ChatMessage } from "../../types/agent";
import type { PipelineResult, PipelineStageName, RailAssignments, VersionInfo, CircuitAnalysisResult, PortVisualizationResult, ReferenceSummary, ManualNetRoleAssignment } from "../../types/pipeline";
import type { CanvasMode, RunState } from "../../types/ui";
import { createClientId } from "../../utils/id";

export type PipelineProgress = {
  activeStage: PipelineStageName | null;
  completedStages: PipelineStageName[];
};

export type DemoState = {
  stationId: string;
  runState: RunState;
  backendOnline: boolean;
  backendMessage: string;
  version: VersionInfo | null;
  file: File | null;
  imageUrl: string;
  base64: string;
  error: string;
  conf: number;
  iou: number;
  imgsz: number;
  rails: RailAssignments;
  activeMode: CanvasMode;
  pipelineResult: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null;
  manualCorrections: Map<string, string>;
  manualNetRoleAssignments: Map<string, ManualNetRoleAssignment>;
  agentStatus: "idle" | "running" | "success" | "error";
  agentResult: AgentStatusResponse | null;
  agentError: string;
  chatMessages: ChatMessage[];
  pipelineProgress: PipelineProgress;
  references: ReferenceSummary[];
  selectedReferenceId: string | null;
  referenceStatus: "idle" | "loading" | "success" | "error";
  referenceError: string;
};

export type DemoAction =
  | { type: "backend"; online: boolean; message: string; version?: VersionInfo | null }
  | { type: "select-file"; file: File; imageUrl: string; base64: string }
  | { type: "set-option"; key: "conf" | "iou" | "imgsz"; value: number }
  | { type: "set-rail"; key: keyof RailAssignments; value: string }
  | { type: "set-mode"; mode: CanvasMode }
  | { type: "set-manual-corrections"; corrections: Map<string, string> }
  | { type: "reset-manual-corrections" }
  | { type: "set-manual-net-role"; key: string; assignment: ManualNetRoleAssignment | null }
  | { type: "reset-manual-net-roles" }
  | { type: "run-start" }
  | { type: "corrected-recompute-start" }
  | { type: "corrected-recompute-success"; result: PipelineResult }
  | { type: "run-success"; result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult }
  | { type: "run-error"; error: string }
  | { type: "agent-start"; prompt: string; placeholderId: string }
  | { type: "agent-progress"; phase: AgentProgressPhase }
  | { type: "agent-success"; result: AgentStatusResponse }
  | { type: "chat-stream-tick"; messageId: string; chars: number }
  | { type: "chat-stream-done"; messageId: string }
  | { type: "agent-error"; error: string }
  | { type: "chat-assistant"; content: string; actions?: AgentAction[] }
  | { type: "pipeline-progress-tick"; activeStage: PipelineStageName | null; completedStages: PipelineStageName[] }
  | { type: "references-loading" }
  | { type: "references-success"; references: ReferenceSummary[] }
  | { type: "references-error"; error: string }
  | { type: "select-reference"; referenceId: string | null };

export const initialDemoState: DemoState = {
  stationId: "LG-DEMO-01",
  runState: "idle",
  backendOnline: false,
  backendMessage: "正在检查后端",
  version: null,
  file: null,
  imageUrl: "",
  base64: "",
  error: "",
  conf: 0.25,
  iou: 0.5,
  imgsz: 960,
  rails: {
    top_plus: "VCC",
    top_minus: "VCC",
    bot_plus: "GND",
    bot_minus: "GND",
  },
  activeMode: "detect",
  pipelineResult: null,
  manualCorrections: new Map(),
  manualNetRoleAssignments: new Map(),
  agentStatus: "idle",
  agentResult: null,
  agentError: "",
  chatMessages: [],
  pipelineProgress: { activeStage: null, completedStages: [] },
  references: [],
  selectedReferenceId: null,
  referenceStatus: "idle",
  referenceError: "",
};

const PROGRESS_PHASE_TEXT: Record<AgentProgressPhase, string> = {
  retrieving: "📚 正在检索知识库...",
  reasoning: "🧠 正在结合诊断证据推理...",
  composing: "✍️ 正在生成回答...",
};

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "backend":
      return {
        ...state,
        backendOnline: action.online,
        backendMessage: action.message,
        version: action.version ?? state.version,
      };
    case "select-file":
      return {
        ...state,
        file: action.file,
        imageUrl: action.imageUrl,
        base64: action.base64,
        runState: "ready",
        error: "",
        pipelineResult: null,
        manualCorrections: new Map(),
        manualNetRoleAssignments: new Map(),
        agentResult: null,
        agentError: "",
        agentStatus: "idle",
        chatMessages: [],
        pipelineProgress: { activeStage: null, completedStages: [] },
      };
    case "set-option":
      return { ...state, [action.key]: action.value };
    case "set-rail":
      return { ...state, rails: { ...state.rails, [action.key]: action.value } };
    case "set-mode":
      return { ...state, activeMode: action.mode };
    case "set-manual-corrections":
      return { ...state, manualCorrections: new Map(action.corrections) };
    case "reset-manual-corrections":
      return { ...state, manualCorrections: new Map(), manualNetRoleAssignments: new Map() };
    case "set-manual-net-role": {
      const next = new Map(state.manualNetRoleAssignments);
      if (action.assignment === null) {
        next.delete(action.key);
      } else {
        next.set(action.key, action.assignment);
      }
      return { ...state, manualNetRoleAssignments: next };
    }
    case "reset-manual-net-roles":
      return { ...state, manualNetRoleAssignments: new Map() };
    case "run-start":
      return {
        ...state,
        runState: "running",
        error: "",
        manualCorrections: new Map(),
        manualNetRoleAssignments: new Map(),
        agentStatus: "idle",
        agentError: "",
        chatMessages: [],
        agentResult: null,
        pipelineProgress: { activeStage: null, completedStages: [] },
      };
    case "corrected-recompute-start":
      return {
        ...state,
        runState: "running",
        error: "",
        pipelineProgress: { activeStage: "topology", completedStages: ["detect", "pin_detect", "mapping"] },
      };
    case "corrected-recompute-success": {
      // 合并策略：保留旧 pipelineResult 中的 detect/pin_detect/mapping 阶段数据，
      // 用新结果中的 topology/validate/semantic_analysis 阶段替换，避免清空引脚定位与检测结果。
      const oldResult = state.pipelineResult;
      let mergedResult = action.result;
      if (
        oldResult &&
        "stages" in oldResult &&
        Array.isArray(oldResult.stages) &&
        action.result &&
        "stages" in action.result &&
        Array.isArray(action.result.stages)
      ) {
        const newStages = action.result.stages;
        const oldStages = oldResult.stages;
        const newStageNames = new Set(newStages.map((s) => s.stage));
        const preservedStages = oldStages.filter((s) => !newStageNames.has(s.stage));
        mergedResult = {
          ...action.result,
          stages: [...preservedStages, ...newStages],
        } as PipelineResult;
      }
      return {
        ...state,
        runState: "success",
        pipelineResult: mergedResult,
        manualCorrections: new Map(),
        agentResult: null,
        agentError: "",
        pipelineProgress: {
          activeStage: null,
          completedStages: ["detect", "pin_detect", "mapping", "topology", "validate", "semantic_analysis"],
        },
      };
    }
    case "run-success":
      return {
        ...state,
        runState: "success",
        pipelineResult: action.result,
        chatMessages: [],
        agentResult: null,
        agentError: "",
        pipelineProgress: {
          activeStage: null,
          completedStages: ["detect", "pin_detect", "mapping", "topology", "validate", "semantic_analysis"],
        },
      };
    case "pipeline-progress-tick":
      return {
        ...state,
        pipelineProgress: {
          activeStage: action.activeStage,
          completedStages: action.completedStages,
        },
      };
    case "run-error":
      return { ...state, runState: "error", error: action.error };
    case "agent-start":
      return {
        ...state,
        agentStatus: "running",
        agentError: "",
        agentResult: null,
        chatMessages: [
          ...state.chatMessages,
          {
            id: createClientId(),
            role: "user",
            content: action.prompt,
            createdAt: Date.now(),
          },
          {
            id: action.placeholderId,
            role: "assistant",
            content: PROGRESS_PHASE_TEXT.retrieving,
            createdAt: Date.now(),
            status: "sending",
            phase: "retrieving",
          },
        ],
      };
    case "agent-progress":
      return {
        ...state,
        chatMessages: state.chatMessages.map((msg) =>
          msg.role === "assistant" && (msg.status === "sending" || msg.status === "streaming")
            ? { ...msg, content: PROGRESS_PHASE_TEXT[action.phase], phase: action.phase, status: "sending" as const }
            : msg,
        ),
      };
    case "agent-success": {
      const fullAnswer = action.result.result?.answer ?? "";
      const result = action.result.result;
      const hasSending = state.chatMessages.some(
        (m) => m.role === "assistant" && (m.status === "sending" || m.status === "streaming"),
      );
      const updated = state.chatMessages.map((msg) => {
        if (msg.role === "assistant" && (msg.status === "sending" || msg.status === "streaming")) {
          return {
            ...msg,
            content: "",
            streamedContent: "",
            pendingAnswer: fullAnswer,
            status: "streaming" as const,
            phase: undefined,
            actions: result?.actions,
            citations: result?.citations,
            evidence: result?.evidence,
            followUps: result?.follow_up_suggestions,
          };
        }
        return msg;
      });
      const finalMessages = hasSending
        ? updated
        : [
            ...updated,
            {
              id: createClientId(),
              role: "assistant" as const,
              content: "",
              streamedContent: "",
              pendingAnswer: fullAnswer,
              createdAt: Date.now(),
              status: "streaming" as const,
              actions: result?.actions,
              citations: result?.citations,
              evidence: result?.evidence,
              followUps: result?.follow_up_suggestions,
            },
          ];
      return {
        ...state,
        agentStatus: "success",
        agentResult: action.result,
        chatMessages: finalMessages,
      };
    }
    case "chat-stream-tick":
      return {
        ...state,
        chatMessages: state.chatMessages.map((msg) => {
          if (msg.id !== action.messageId || msg.status !== "streaming" || !msg.pendingAnswer) return msg;
          const target = (msg.streamedContent?.length ?? 0) + action.chars;
          const next = msg.pendingAnswer.slice(0, target);
          return { ...msg, streamedContent: next, content: next };
        }),
      };
    case "chat-stream-done":
      return {
        ...state,
        chatMessages: state.chatMessages.map((msg) => {
          if (msg.id !== action.messageId) return msg;
          const full = msg.pendingAnswer ?? msg.content;
          return {
            ...msg,
            content: full,
            streamedContent: full,
            status: "sent" as const,
            pendingAnswer: undefined,
          };
        }),
      };
    case "agent-error":
      return {
        ...state,
        agentStatus: "error",
        agentError: action.error,
        chatMessages: state.chatMessages
          .filter(
            (msg) =>
              !(msg.role === "assistant" && (msg.status === "sending" || msg.status === "streaming")),
          )
          .concat([
            {
              id: createClientId(),
              role: "assistant",
              content: "回答生成失败，请稍后重试。",
              createdAt: Date.now(),
              status: "error",
            },
          ]),
      };
    case "chat-assistant":
      return {
        ...state,
        chatMessages: [
          ...state.chatMessages,
          {
            id: createClientId(),
            role: "assistant",
            content: action.content,
            createdAt: Date.now(),
            actions: action.actions,
          },
        ],
      };
    case "references-loading":
      return { ...state, referenceStatus: "loading", referenceError: "" };
    case "references-success":
      return {
        ...state,
        referenceStatus: "success",
        references: action.references,
        referenceError: "",
        selectedReferenceId:
          state.selectedReferenceId ??
          action.references[0]?.reference_id ??
          null,
      };
    case "references-error":
      return {
        ...state,
        referenceStatus: "error",
        referenceError: action.error,
      };
    case "select-reference":
      return {
        ...state,
        selectedReferenceId: action.referenceId,
      };
    default:
      return state;
  }
}
