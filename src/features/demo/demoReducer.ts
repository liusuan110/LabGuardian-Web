import type { AgentStatusResponse } from "../../types/agent";
import type { PipelineResult, RailAssignments, VersionInfo } from "../../types/pipeline";
import type { CanvasMode, RunState } from "../../types/ui";

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
  pipelineResult: PipelineResult | null;
  agentStatus: "idle" | "running" | "success" | "error";
  agentResult: AgentStatusResponse | null;
  agentError: string;
};

export type DemoAction =
  | { type: "backend"; online: boolean; message: string; version?: VersionInfo | null }
  | { type: "select-file"; file: File; imageUrl: string; base64: string }
  | { type: "set-option"; key: "conf" | "iou" | "imgsz"; value: number }
  | { type: "set-rail"; key: keyof RailAssignments; value: string }
  | { type: "set-mode"; mode: CanvasMode }
  | { type: "run-start" }
  | { type: "run-success"; result: PipelineResult }
  | { type: "run-error"; error: string }
  | { type: "agent-start" }
  | { type: "agent-success"; result: AgentStatusResponse }
  | { type: "agent-error"; error: string };

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
    top_minus: "GND",
    bot_plus: "VCC",
    bot_minus: "GND",
  },
  activeMode: "detect",
  pipelineResult: null,
  agentStatus: "idle",
  agentResult: null,
  agentError: "",
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
        agentResult: null,
        agentError: "",
        agentStatus: "idle",
      };
    case "set-option":
      return { ...state, [action.key]: action.value };
    case "set-rail":
      return { ...state, rails: { ...state.rails, [action.key]: action.value } };
    case "set-mode":
      return { ...state, activeMode: action.mode };
    case "run-start":
      return { ...state, runState: "running", error: "", agentStatus: "idle", agentError: "" };
    case "run-success":
      return { ...state, runState: "success", pipelineResult: action.result };
    case "run-error":
      return { ...state, runState: "error", error: action.error };
    case "agent-start":
      return { ...state, agentStatus: "running", agentError: "", agentResult: null };
    case "agent-success":
      return { ...state, agentStatus: "success", agentResult: action.result };
    case "agent-error":
      return { ...state, agentStatus: "error", agentError: action.error };
    default:
      return state;
  }
}
