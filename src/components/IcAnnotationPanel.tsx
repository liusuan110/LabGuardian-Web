import { Cpu } from "lucide-react";
import type {
  CircuitAnalysisResult,
  IcAnnotation,
  IcNotchDirection,
  PipelineResult,
  PortVisualizationResult,
  ReferenceIcSubtypeRecord,
} from "../types/pipeline";
import {
  getIcAnnotationComponents,
  getIcNotchDirection,
  icAnnotationKey,
  normalizePackageType,
} from "../utils/icAnnotations";

/**
 * 从 result.runtime_metadata.reference_ic_subtypes_applied 提取记录列表，
 * 按 component_id 索引。前端用来在 IC 行旁边标 "由参考绑定" 徽章。
 */
function buildSubtypeSourceMap(
  result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null,
): Map<string, ReferenceIcSubtypeRecord> {
  const map = new Map<string, ReferenceIcSubtypeRecord>();
  if (!result) return map;
  // PipelineResult 持有 runtime_metadata；其他形态可能没有这个字段。
  const meta = (result as { runtime_metadata?: Record<string, unknown> }).runtime_metadata;
  if (!meta) return map;
  const records = meta.reference_ic_subtypes_applied;
  if (!Array.isArray(records)) return map;
  for (const item of records) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const cid = String(record.component_id ?? "").trim();
    const subtype = String(record.part_subtype ?? "").trim();
    if (!cid || !subtype) continue;
    map.set(cid, {
      component_id: cid,
      part_subtype: subtype,
      source: String(record.source ?? "unknown"),
      matched_by: String(record.matched_by ?? "unknown"),
    });
  }
  return map;
}

function subtypeBadge(
  partSubtype: string | undefined,
  sourceRecord: ReferenceIcSubtypeRecord | undefined,
) {
  const value = (partSubtype || "").trim();
  if (!value) {
    return <span className="ic-subtype-badge ic-subtype-badge-empty">未识别</span>;
  }
  const fromReference = sourceRecord?.source === "reference_circuit";
  const className = fromReference
    ? "ic-subtype-badge ic-subtype-badge-bound"
    : "ic-subtype-badge ic-subtype-badge-vision";
  const title = fromReference
    ? `由参考电路自动绑定 (matched_by=${sourceRecord?.matched_by})`
    : "来自视觉识别 (OCR / 库匹配)";
  return (
    <span className={className} title={title}>
      <span className="ic-subtype-name">{value}</span>
      {fromReference ? <span className="ic-subtype-badge-suffix">来自参考</span> : null}
    </span>
  );
}

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
  // 把 runtime_metadata.reference_ic_subtypes_applied[] 索引一下，用于在每个
  // IC 行旁标"由参考绑定"徽章。读不到也无所谓 — badge 会回退到"未识别"。
  const subtypeSourceMap = buildSubtypeSourceMap(result);

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
              <th>芯片型号</th>
              <th>后端 package_type</th>
              <th>notch_direction</th>
            </tr>
          </thead>
          <tbody>
            {icComponents.map((component) => {
              const componentId = component.component_id ?? "";
              const direction = getIcNotchDirection(icAnnotations, componentId);
              const sourceRecord = subtypeSourceMap.get(componentId);
              return (
                <tr key={componentId}>
                  <td className="net-cell">{componentId}</td>
                  <td>{subtypeBadge(component.part_subtype, sourceRecord)}</td>
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
