import type {
  Detection,
  PipelineComponent,
  PipelineResult,
  PipelineStageName,
  StageData,
  StageResult,
} from "../types/pipeline";

const STAGE_LABELS: Record<PipelineStageName, string> = {
  detect: "S1 元件检测",
  pin_detect: "S1.5 引脚定位",
  mapping: "S2 孔位映射",
  topology: "S3 网表拓扑",
  validate: "S4 风险校验",
};

export function stageLabel(stage: PipelineStageName) {
  return STAGE_LABELS[stage] ?? stage;
}

export function getStage(result: PipelineResult | null, stage: PipelineStageName): StageResult | null {
  return result?.stages.find((item) => item.stage === stage) ?? null;
}

export function getStageData(result: PipelineResult | null, stage: PipelineStageName): StageData {
  return getStage(result, stage)?.data ?? {};
}

export function getDetections(result: PipelineResult | null): Detection[] {
  return getStageData(result, "detect").detections ?? [];
}

export function getPinComponents(result: PipelineResult | null): PipelineComponent[] {
  return getStageData(result, "pin_detect").components ?? [];
}

export function getMappedComponents(result: PipelineResult | null): PipelineComponent[] {
  return getStageData(result, "mapping").components ?? [];
}

export function getNetCount(result: PipelineResult | null) {
  const netlist = getStageData(result, "topology").netlist_v2;
  return result?.net_count || netlist?.nets?.length || 0;
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
