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

const RISK_LABELS: Record<string, string> = {
  safe: "安全",
  low: "低风险",
  warning: "注意",
  danger: "高风险",
  fatal: "严重",
  unknown: "未评估",
};

/** Map a backend risk_level enum to a Chinese label (falls back to the raw value). */
export function riskLabel(risk: string | undefined | null): string {
  if (!risk) return "等待诊断";
  return RISK_LABELS[risk] ?? risk;
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
