import type {
  Detection,
  PipelineComponent,
  PipelineResult,
  PipelineStageName,
  StageData,
  StageResult,
  CircuitAnalysisResult,
  PortVisualizationResult,
} from "../types/pipeline";

const STAGE_LABELS: Record<PipelineStageName, string> = {
  detect: "S1 元件检测",
  pin_detect: "S1.5 引脚定位",
  mapping: "S2 孔位映射",
  topology: "S3 网表拓扑",
  validate: "S4 风险校验",
  semantic_analysis: "S5 语义纠错",
};

export function stageLabel(stage: PipelineStageName) {
  return STAGE_LABELS[stage] ?? stage;
}

export function getStage(result: PipelineResult | null, stage: PipelineStageName): StageResult | null {
  return (Array.isArray(result?.stages) ? result.stages : []).find((item) => item.stage === stage) ?? null;
}

export function getStageData(result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null, stage: PipelineStageName): StageData {
  if (!result || "stages" in result === false) return {};
  return getStage(result as PipelineResult, stage)?.data ?? {};
}

export function getDetections(result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null): Detection[] {
  if (!result || "stages" in result === false) return [];
  const detections = getStageData(result as PipelineResult, "detect").detections;
  return Array.isArray(detections) ? detections : [];
}

export function getPinComponents(result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null): PipelineComponent[] {
  if (!result || "stages" in result === false) return [];
  const components = getStageData(result as PipelineResult, "pin_detect").components;
  return Array.isArray(components) ? components : [];
}

export function getMappedComponents(result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null): PipelineComponent[] {
  if (!result) return [];
  
  if ("components" in result) {
    const circuitResult = result as CircuitAnalysisResult;
    if ("pins" in (circuitResult.components[0] || {})) {
      return circuitResult.components.map((comp) => ({
        component_id: comp.component_id,
        component_type: comp.component_type,
        class_name: comp.component_type,
        package_type: comp.package_type,
        bbox: comp.bbox,
        confidence: comp.confidence,
        pins: comp.pins.map((pin) => ({
          pin_id: pin.pin_id,
          pin_name: pin.pin_name,
          pin_display_name: pin.pin_display_name,
          polarity_role: pin.polarity_role,
          polarity_candidate_role: pin.polarity_candidate_role,
          hole_id: pin.hole_id,
          electrical_node_id: pin.electrical_node_id,
          electrical_net_id: pin.electrical_net_id,
          x_image: pin.x_image,
          y_image: pin.y_image,
          x_warp: pin.x_warp,
          y_warp: pin.y_warp,
          source: pin.source,
          source_by_view: pin.source_by_view,
        })),
      }));
    }
  }
  
  const components = getStageData(result as PipelineResult, "mapping").components;
  return Array.isArray(components) ? components : [];
}

export function getNetCount(result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null): number {
  if (!result) return 0;
  
  if ("net_count" in result) {
    return result.net_count;
  }
  
  const netlist = getStageData(result as PipelineResult, "topology").netlist_v2;
  return (result as PipelineResult).net_count || netlist?.nets?.length || 0;
}

export function asPercent(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0%";
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

export function formatDuration(ms: number | undefined) {
  if (!ms) return "0 ms";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
