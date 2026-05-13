import { runPipeline, analyzeCircuit, visualizePorts } from "../../api/pipeline";
import type { CircuitAnalysisResult, PipelineStageName, PortVisualizationResult } from "../../types/pipeline";
import { portAnnotationsToList } from "../../utils/portAnnotation";
import type { DemoAction, DemoState } from "./demoReducer";

const STAGE_RHYTHM: Array<{ stage: PipelineStageName; durationMs: number }> = [
  { stage: "detect", durationMs: 1200 },
  { stage: "pin_detect", durationMs: 1800 },
  { stage: "mapping", durationMs: 1000 },
  { stage: "topology", durationMs: 800 },
  { stage: "validate", durationMs: 600 },
  { stage: "semantic_analysis", durationMs: 400 },
];

function startStageProgressTimers(dispatch: React.Dispatch<DemoAction>): () => void {
  const timeouts: number[] = [];
  const completed: PipelineStageName[] = [];
  let elapsed = 0;

  STAGE_RHYTHM.forEach(({ stage, durationMs }, index) => {
    const startAt = elapsed;
    timeouts.push(
      window.setTimeout(() => {
        dispatch({
          type: "pipeline-progress-tick",
          activeStage: stage,
          completedStages: [...completed],
        });
      }, startAt),
    );
    const endAt = elapsed + durationMs;
    timeouts.push(
      window.setTimeout(() => {
        completed.push(stage);
        const nextStage = STAGE_RHYTHM[index + 1]?.stage ?? null;
        dispatch({
          type: "pipeline-progress-tick",
          activeStage: nextStage,
          completedStages: [...completed],
        });
      }, endAt),
    );
    elapsed = endAt;
  });

  return () => timeouts.forEach((id) => window.clearTimeout(id));
}

export function usePipelineRun(
  state: DemoState,
  dispatch: React.Dispatch<DemoAction>,
  onPipelineComplete?: (prompt: string, result: Awaited<ReturnType<typeof runPipeline>>) => Promise<void>,
) {
  async function execute() {
    if (!state.file || !state.base64 || state.runState === "running") return;

    dispatch({ type: "run-start" });
    const stopProgress = startStageProgressTimers(dispatch);
    try {
      const pipeline = await runPipeline({
        station_id: state.stationId,
        images_b64: [state.base64],
        conf: state.conf,
        iou: state.iou,
        imgsz: state.imgsz,
        reference_id: state.selectedReferenceId,
        reference_circuit: null,
        rail_assignments: state.rails,
        port_annotations: portAnnotationsToList(state.portAnnotations),
        net_role_assignments: Array.from(state.manualNetRoleAssignments.values()),
      });
      stopProgress();
      dispatch({ type: "run-success", result: pipeline });
      await onPipelineComplete?.("请根据当前诊断结果给出演示用诊断解释和下一步建议。", pipeline);
    } catch (error) {
      stopProgress();
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
        reference_id: state.selectedReferenceId,
        reference_circuit: null,
        rail_assignments: state.rails,
        port_annotations: portAnnotationsToList(state.portAnnotations),
        net_role_assignments: Array.from(state.manualNetRoleAssignments.values()),
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
        reference_id: state.selectedReferenceId,
        reference_circuit: null,
        rail_assignments: state.rails,
        port_annotations: portAnnotationsToList(state.portAnnotations),
        net_role_assignments: Array.from(state.manualNetRoleAssignments.values()),
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
