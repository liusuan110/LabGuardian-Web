import type {
  Detection,
  IcAnnotation,
  IcNotchDirection,
  PipelineComponent,
  PipelineResult,
  CircuitAnalysisResult,
  PortVisualizationResult,
} from "../types/pipeline";
import { getDetections, getMappedComponents, getPinComponents } from "./pipeline";

type PipelineLikeResult = PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null;

const IC_KEYWORDS = ["ic", "integrated", "chip", "dip"];

function normalizeText(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function normalizePackageType(packageType: string | undefined): string {
  return normalizeText(packageType);
}

export function isIcLikeComponent(component: Pick<PipelineComponent, "component_type" | "class_name" | "package_type">): boolean {
  const packageType = normalizePackageType(component.package_type);
  if (packageType.startsWith("dip")) return true;

  const labels = [component.component_type, component.class_name].map(normalizeText).filter(Boolean);
  return labels.some((label) => IC_KEYWORDS.some((keyword) => label === keyword || label.includes(keyword)));
}

function detectionToComponent(detection: Detection): PipelineComponent {
  return {
    component_id: detection.component_id,
    component_type: detection.component_type,
    class_name: detection.class_name,
    package_type: detection.package_type,
    bbox: detection.bbox,
    confidence: detection.confidence,
    orientation: detection.orientation,
  };
}

export function getIcAnnotationComponents(result: PipelineLikeResult): PipelineComponent[] {
  if (!result) return [];

  const byId = new Map<string, PipelineComponent>();
  const addComponent = (component: PipelineComponent) => {
    if (!component.component_id || !isIcLikeComponent(component)) return;
    byId.set(component.component_id, { ...byId.get(component.component_id), ...component });
  };

  getDetections(result).map(detectionToComponent).forEach(addComponent);
  getPinComponents(result).forEach(addComponent);
  getMappedComponents(result).forEach(addComponent);

  return Array.from(byId.values()).sort((a, b) =>
    String(a.component_id ?? "").localeCompare(String(b.component_id ?? "")),
  );
}

export function icAnnotationKey(componentId: string): string {
  return `ic:${componentId}`;
}

export function getIcNotchDirection(
  annotations: Map<string, IcAnnotation>,
  componentId: string,
): IcNotchDirection {
  return annotations.get(icAnnotationKey(componentId))?.notch_direction ?? "unknown";
}

export function buildIcAnnotations(
  result: PipelineLikeResult,
  annotations: Map<string, IcAnnotation>,
): IcAnnotation[] {
  return getIcAnnotationComponents(result).flatMap((component) => {
    const componentId = component.component_id;
    if (!componentId) return [];
    const annotation: IcAnnotation = {
      component_id: componentId,
      notch_direction: getIcNotchDirection(annotations, componentId),
    };
    if (component.package_type) {
      annotation.package_type = component.package_type;
    }
    return [annotation];
  });
}
