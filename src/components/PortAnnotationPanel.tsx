import type {
  CircuitAnalysisResult,
  LogicalReference,
  LogicalReferenceNet,
  PipelineResult,
  PortAnnotation,
  PortVisualizationResult,
} from "../types/pipeline";
import { getStageData } from "../utils/pipeline";
import {
  isPortReferenceNet,
  normalizeReferenceRole,
  referenceNetLabel,
} from "../utils/referenceRoles";
import { buildPortAnnotation, portAnnotationKey } from "../utils/portAnnotation";

type Props = {
  result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null;
  currentReference: LogicalReference | null;
  portAnnotations: Map<string, PortAnnotation>;
  onPortAnnotationChange: (key: string, annotation: PortAnnotation | null) => void;
  onResetPortAnnotations: () => void;
  onApplyAnnotations: () => void;
  isApplying?: boolean;
  // 用于检测端口与高级网络全标注的冲突，给出提示
  netRoleAssignmentKeys?: Set<string>;
};

type CurrentNetCandidate = {
  electricalNetId: string;
  powerRole?: string;
  roleLabel?: string;
  componentCount: number;
  holeCount: number;
  /** true = 已被识别为电源/地轨道，不是 input/output 候选 */
  isRail: boolean;
};

const RAIL_LABELS = new Set(["VCC", "VEE", "VDD", "VSS", "GND"]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value ? value : undefined;
}

function isRailRecord(record: Record<string, unknown>): boolean {
  const power = (stringField(record, "power_role") || "").toUpperCase();
  if (RAIL_LABELS.has(power)) return true;
  const role = (stringField(record, "role") || stringField(record, "manual_role") || "").toLowerCase();
  if (role === "power" || role === "ground") return true;
  const label = (stringField(record, "role_label") || "").toUpperCase();
  if (RAIL_LABELS.has(label)) return true;
  return false;
}

function getCandidateNets(result: Props["result"]): CurrentNetCandidate[] {
  if (!result) return [];

  if ("stages" in result) {
    const netlist = getStageData(result, "topology").netlist_v2;
    const nets = Array.isArray(netlist?.nets) ? netlist.nets : [];
    return nets.flatMap((net) => {
      const record = asRecord(net);
      const electricalNetId = stringField(record, "electrical_net_id") ?? stringField(record, "net_id");
      if (!electricalNetId) return [];
      const pins = Array.isArray(record.pins) ? record.pins.map(asRecord) : [];
      const components = new Set<string>();
      const holes = new Set<string>();
      for (const pin of pins) {
        const componentId = stringField(pin, "component_id") ?? stringField(pin, "component");
        const holeId = stringField(pin, "hole_id");
        if (componentId) components.add(componentId);
        if (holeId) holes.add(holeId);
      }
      return [
        {
          electricalNetId,
          powerRole: stringField(record, "power_role"),
          roleLabel: stringField(record, "role_label"),
          componentCount: components.size,
          holeCount: holes.size,
          isRail: isRailRecord(record),
        },
      ];
    });
  }

  if ("nets" in result && Array.isArray(result.nets)) {
    return result.nets.flatMap((net) => {
      const record = asRecord(net);
      const electricalNetId = stringField(record, "electrical_net_id") ?? stringField(record, "net_id");
      if (!electricalNetId) return [];
      return [
        {
          electricalNetId,
          powerRole: stringField(record, "power_role"),
          componentCount: 0,
          holeCount: Array.isArray(record.member_hole_ids) ? record.member_hole_ids.length : 0,
          isRail: isRailRecord(record),
        },
      ];
    });
  }

  return [];
}

function describeCandidate(candidate: CurrentNetCandidate): string {
  const parts = [candidate.electricalNetId];
  if (candidate.componentCount || candidate.holeCount) {
    parts.push(`${candidate.componentCount}元/${candidate.holeCount}孔`);
  }
  if (candidate.powerRole) {
    parts.push(candidate.powerRole);
  }
  return parts.join(" · ");
}

export function PortAnnotationPanel({
  result,
  currentReference,
  portAnnotations,
  onPortAnnotationChange,
  onResetPortAnnotations,
  onApplyAnnotations,
  isApplying = false,
  netRoleAssignmentKeys,
}: Props) {
  const candidates = getCandidateNets(result);
  const portCandidates = candidates.filter((net) => !net.isRail);
  const referenceNets = currentReference?.nets ?? [];
  const portRefNets = referenceNets.filter(isPortReferenceNet);

  // 反向索引：currentNetId -> 已标注到哪个参考端口
  const annotationByNetId = new Map<string, PortAnnotation>();
  for (const annotation of portAnnotations.values()) {
    const netId = annotation.target.electrical_net_id;
    if (netId) annotationByNetId.set(netId, annotation);
  }

  // 当前参考端口已被哪个 currentNet 占用（用于在其它行的下拉里灰掉）
  const portRefToNetId = new Map<string, string>();
  for (const annotation of portAnnotations.values()) {
    const label = (annotation.label || "").toUpperCase();
    const netId = annotation.target.electrical_net_id;
    if (label && netId) portRefToNetId.set(label, netId);
  }

  function handleSelect(refNet: LogicalReferenceNet, electricalNetId: string) {
    const refLabel = referenceNetLabel(refNet).toUpperCase();
    // 清掉同一参考端口之前的标注
    const previousNetId = portRefToNetId.get(refLabel);
    if (previousNetId) onPortAnnotationChange(portAnnotationKey(previousNetId), null);

    if (!electricalNetId) return;

    // 同一 currentNet 不能既是 X 又是 Y：清掉它之前的标注
    if (annotationByNetId.has(electricalNetId)) {
      onPortAnnotationChange(portAnnotationKey(electricalNetId), null);
    }

    const annotation = buildPortAnnotation(refNet, electricalNetId);
    if (annotation) onPortAnnotationChange(portAnnotationKey(electricalNetId), annotation);
  }

  return (
    <section className="net-role-panel">
      <div className="panel-heading">
        <div>
          <h2>端口标注</h2>
          <p className="muted">
            为参考电路的每个输入/输出端口指定它对应当前电路的哪个网络。VCC/GND 已通过电源轨指定，无需在此重复；
            候选只显示信号网络（自动过滤已分配到电源/地轨的网络）。
          </p>
        </div>
        <span className="manual-role-summary">
          已标注 {portAnnotations.size} / {portRefNets.length}
        </span>
      </div>

      {!currentReference ? (
        <p className="muted">请先选择逻辑参考电路。</p>
      ) : null}
      {currentReference && portRefNets.length === 0 ? (
        <p className="muted">当前参考电路未声明输入/输出端口，无需标注。</p>
      ) : null}
      {currentReference && portRefNets.length > 0 && portCandidates.length === 0 ? (
        <p className="muted">完成 S3 拓扑阶段后即可标注端口。</p>
      ) : null}

      {currentReference && portRefNets.length > 0 && portCandidates.length > 0 ? (
        <div className="bb-pin-role-table-wrap">
          <table className="bb-pin-role-table net-role-table">
            <thead>
              <tr>
                <th>参考端口</th>
                <th>角色</th>
                <th>当前网络</th>
              </tr>
            </thead>
            <tbody>
              {portRefNets.map((refNet) => {
                const refLabel = referenceNetLabel(refNet);
                const role = normalizeReferenceRole(refNet.role, refLabel);
                const selectedNetId = portRefToNetId.get(refLabel.toUpperCase()) ?? "";
                return (
                  <tr key={refNet.net}>
                    <td className="net-cell">
                      <strong>{refLabel}</strong>
                    </td>
                    <td>
                      <span className={`net-role-badge role-${role}`}>{role}</span>
                    </td>
                    <td>
                      <select
                        className="net-role-select"
                        value={selectedNetId}
                        onChange={(event) => handleSelect(refNet, event.target.value)}
                      >
                        <option value="">未标注（由系统推断）</option>
                        {portCandidates.map((candidate) => {
                          const netId = candidate.electricalNetId;
                          const occupiedByOther = Array.from(portRefToNetId.entries()).some(
                            ([label, occupiedNetId]) =>
                              occupiedNetId === netId && label !== refLabel.toUpperCase(),
                          );
                          const conflictedByAdvanced =
                            netRoleAssignmentKeys?.has(portAnnotationKey(netId)) ?? false;
                          return (
                            <option
                              key={netId}
                              value={netId}
                              disabled={occupiedByOther}
                              title={
                                occupiedByOther
                                  ? "该网络已被分配给其它端口"
                                  : conflictedByAdvanced
                                    ? "该网络在高级面板里已被手动覆盖"
                                    : undefined
                              }
                            >
                              {describeCandidate(candidate)}
                              {occupiedByOther ? "（已用）" : ""}
                              {conflictedByAdvanced ? "（高级覆盖）" : ""}
                            </option>
                          );
                        })}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="manual-correction-actions compact-actions">
        <button
          type="button"
          className="run-button correction-compare-button"
          onClick={onApplyAnnotations}
          disabled={isApplying}
        >
          {isApplying ? "正在重新比较..." : "应用端口标注并重新比较"}
        </button>
        {portAnnotations.size > 0 ? (
          <button type="button" className="bb-reset-btn" onClick={onResetPortAnnotations}>
            重置端口标注
          </button>
        ) : null}
      </div>
    </section>
  );
}
