import type { PipelineComponent } from "../types/pipeline";

function normalizeText(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function normalizePackageType(packageType: string | undefined): string {
  return normalizeText(packageType);
}

export function isIcLikeComponent(component: Pick<PipelineComponent, "component_type" | "class_name" | "package_type">): boolean {
  if ((component.component_type ?? "").trim().toUpperCase() === "IC") return true;

  const packageType = normalizePackageType(component.package_type);
  return packageType === "dip8" || packageType === "dip14";
}
