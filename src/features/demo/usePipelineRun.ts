import { askAgent, waitForAgentResult } from "../../api/agent";
import { runPipeline } from "../../api/pipeline";
import type { DemoAction, DemoState } from "./demoReducer";

export function usePipelineRun(state: DemoState, dispatch: React.Dispatch<DemoAction>) {
  async function execute() {
    if (!state.file || !state.base64 || state.runState === "running") return;

    dispatch({ type: "run-start" });
    try {
      const pipeline = await runPipeline({
        station_id: state.stationId,
        images_b64: [state.base64],
        conf: state.conf,
        iou: state.iou,
        imgsz: state.imgsz,
        reference_circuit: null,
        rail_assignments: state.rails,
      });
      dispatch({ type: "run-success", result: pipeline });

      dispatch({ type: "agent-start" });
      try {
        const accepted = await askAgent({
          station_id: state.stationId,
          query: "请根据当前 pipeline 事实链给出演示用诊断解释和下一步建议。",
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
    } catch (error) {
      dispatch({
        type: "run-error",
        error: error instanceof Error ? error.message : "Pipeline 运行失败",
      });
    }
  }

  return { execute };
}
