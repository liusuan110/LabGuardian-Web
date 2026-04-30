import { runPipeline, analyzeCircuit, visualizePorts } from "../../api/pipeline";
import type { CircuitAnalysisResult, PortVisualizationResult } from "../../types/pipeline";
import type { DemoAction, DemoState } from "./demoReducer";

export function usePipelineRun(
  state: DemoState,
  dispatch: React.Dispatch<DemoAction>,
  onPipelineComplete?: (prompt: string, result: Awaited<ReturnType<typeof runPipeline>>) => Promise<void>,
) {
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
      await onPipelineComplete?.("请根据当前 pipeline 事实链给出演示用诊断解释和下一步建议。", pipeline);
    } catch (error) {
      dispatch({
        type: "run-error",
        error: error instanceof Error ? error.message : "Pipeline 运行失败",
      });
    }
  }

  async function executeCircuitAnalysis() {
    if (!state.file || !state.base64 || state.runState === "running") return;

    dispatch({ type: "run-start" });
    try {
      const result: CircuitAnalysisResult = await analyzeCircuit({
        station_id: state.stationId,
        images_b64: [state.base64],
        conf: state.conf,
        iou: state.iou,
        imgsz: state.imgsz,
        reference_circuit: null,
        rail_assignments: state.rails,
      });
      
      console.log("电路分析完成:", result);
      console.log("元件列表:", result.components);
      console.log("网表信息:", result.nets);
      console.log("拓扑图:", result.topology_graph);
      
      dispatch({ type: "run-success", result: result });
    } catch (error) {
      dispatch({
        type: "run-error",
        error: error instanceof Error ? error.message : "电路分析失败",
      });
    }
  }

  async function executePortVisualization() {
    if (!state.file || !state.base64 || state.runState === "running") return;

    dispatch({ type: "run-start" });
    try {
      const result: PortVisualizationResult = await visualizePorts({
        station_id: state.stationId,
        images_b64: [state.base64],
        conf: state.conf,
        iou: state.iou,
        imgsz: state.imgsz,
        reference_circuit: null,
        rail_assignments: state.rails,
      });
      
      console.log("端口可视化完成:", result);
      console.log("端口列表:", result.ports);
      console.log("网络信息:", result.nets);
      console.log("元件信息:", result.components);
      
      dispatch({ type: "run-success", result: result });
    } catch (error) {
      dispatch({
        type: "run-error",
        error: error instanceof Error ? error.message : "端口可视化失败",
      });
    }
  }

  return { execute, executeCircuitAnalysis, executePortVisualization };
}
