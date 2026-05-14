import { Cpu } from "lucide-react";
import type {
  CircuitAnalysisResult,
  IcAnnotation,
  IcNotchDirection,
  PipelineResult,
  PortVisualizationResult,
} from "../types/pipeline";
import {
  getIcAnnotationComponents,
  getIcNotchDirection,
  icAnnotationKey,
  normalizePackageType,
} from "../utils/icAnnotations";

type Props = {
  result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null;
  icAnnotations: Map<string, IcAnnotation>;
  onIcAnnotationChange: (key: string, annotation: IcAnnotation | null) => void;
  onResetIcAnnotations: () => void;
  onApplyAnnotations: () => void;
  isApplying?: boolean;
};

const NOTCH_OPTIONS: Array<{ value: IcNotchDirection; label: string }> = [
  { value: "left", label: "left" },
  { value: "right", label: "right" },
  { value: "top", label: "top" },
  { value: "bottom", label: "bottom" },
  { value: "unknown", label: "unknown" },
];

function displayPackageType(packageType: string | undefined): string {
  const normalized = normalizePackageType(packageType);
  return normalized || "后端未返回";
}

export function IcAnnotationPanel({
  result,
  icAnnotations,
  onIcAnnotationChange,
  onResetIcAnnotations,
  onApplyAnnotations,
  isApplying = false,
}: Props) {
  const icComponents = getIcAnnotationComponents(result);
  const hasUnknownDirection = icComponents.some((component) => {
    const componentId = component.component_id;
    return componentId ? getIcNotchDirection(icAnnotations, componentId) === "unknown" : false;
  });

  function handleDirectionChange(componentId: string, packageType: string | undefined, direction: IcNotchDirection) {
    const annotation: IcAnnotation = {
      component_id: componentId,
      notch_direction: direction,
    };
    if (packageType) {
      annotation.package_type = packageType;
    }
    onIcAnnotationChange(icAnnotationKey(componentId), annotation);
  }

  if (!result) return null;

  if (icComponents.length === 0) {
    return (
      <section className="net-role-panel ic-annotation-panel collapsed">
        <div className="panel-heading">
          <div>
            <h2>
              <Cpu size={18} />
              IC 缺口方向标注
            </h2>
          </div>
          <span className="manual-role-summary">未检测到 IC</span>
        </div>
        <p className="muted">未检测到 IC，缺口方向标注已折叠。</p>
      </section>
    );
  }

  return (
    <section className="net-role-panel ic-annotation-panel">
      <div className="panel-heading">
        <div>
          <h2>
            <Cpu size={18} />
            IC 缺口方向标注
          </h2>
          <p className="muted">
            这里只确认芯片缺口方向。芯片筛选仅使用后端 component_type=IC，或后端明确返回 dip8/dip14。
          </p>
        </div>
        <span className="manual-role-summary">IC {icComponents.length} 个</span>
      </div>

      {hasUnknownDirection ? (
        <div className="bb-warning-panel" role="status">
          <p>缺口方向未确认，引脚序号可能不准确。</p>
        </div>
      ) : null}

      <div className="bb-pin-role-table-wrap">
        <table className="bb-pin-role-table ic-annotation-table">
          <thead>
            <tr>
              <th>component_id</th>
              <th>后端 package_type</th>
              <th>notch_direction</th>
            </tr>
          </thead>
          <tbody>
            {icComponents.map((component) => {
              const componentId = component.component_id ?? "";
              const direction = getIcNotchDirection(icAnnotations, componentId);
              return (
                <tr key={componentId}>
                  <td className="net-cell">{componentId}</td>
                  <td>
                    <span className="component-type">{displayPackageType(component.package_type)}</span>
                  </td>
                  <td>
                    <select
                      className="net-role-select"
                      value={direction}
                      onChange={(event) =>
                        handleDirectionChange(
                          componentId,
                          component.package_type,
                          event.target.value as IcNotchDirection,
                        )
                      }
                    >
                      {NOTCH_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="manual-correction-actions compact-actions">
        <button
          type="button"
          className="run-button correction-compare-button"
          onClick={onApplyAnnotations}
          disabled={isApplying}
        >
          {isApplying ? "正在重新计算..." : "应用 IC 缺口方向并重新计算"}
        </button>
        {icAnnotations.size > 0 ? (
          <button type="button" className="bb-reset-btn" onClick={onResetIcAnnotations}>
            重置 IC 方向标注
          </button>
        ) : null}
      </div>
    </section>
  );
}
