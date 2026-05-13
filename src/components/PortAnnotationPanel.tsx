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
  isRailReferenceNet,
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
  // 用于检测端口与高级网络全标注的冲突，给出红字提示
  netRoleAssignmentKeys?: Set<string>;
};

type CurrentNetRow = {
  electricalNetId: string;
  powerRole?: string;
  roleLabel?: string;
  componentCount: number;
  holeCount: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value ? value : undefined;
}

function getCurrentNets(result: Props["result"]): CurrentNetRow[] {
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
        },
      ];
    });
  }

  return [];
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
  const currentNets = getCurrentNets(result);
  const referenceNets = currentReference?.nets ?? [];
  const portRefNets = referenceNets.filter(isPortReferenceNet);
  const railRefNets = referenceNets.filter(isRailReferenceNet);

  const usedLabels = new Set(
    Array.from(portAnnotations.values())
      .map((annotation) => (annotation.label || "").toUpperCase())
      .filter(Boolean),
  );
  const allPortLabels = portRefNets.map(referenceNetLabel);
  const missingPortLabels = allPortLabels.filter((label) => !usedLabels.has(label.toUpperCase()));
  const duplicateLabels = Array.from(
    Array.from(portAnnotations.values())
      .map((annotation) => (annotation.label || "").toUpperCase())
      .filter(Boolean)
      .reduce((counts, label) => counts.set(label, (counts.get(label) ?? 0) + 1), new Map<string, number>()),
  )
    .filter(([, count]) => count > 1)
    .map(([label]) => label);

  function handleSelect(currentNet: CurrentNetRow, refNetName: string) {
    const key = portAnnotationKey(currentNet.electricalNetId);
    if (!refNetName) {
      onPortAnnotationChange(key, null);
      return;
    }
    const refNet = portRefNets.find((item) => item.net === refNetName);
    if (!refNet) return;
    const annotation = buildPortAnnotation(refNet, currentNet.electricalNetId);
    if (annotation) onPortAnnotationChange(key, annotation);
  }

  return (
    <section className="net-role-panel">
      <div className="panel-heading">
        <div>
          <h2>端口标注（最小标注）</h2>
          <p className="muted">
            只需为当前电路选出输入/输出端口（如 UI1 / UO1）。VCC / GND 由上方电源轨指定，其它内部网络由系统自动推断。
          </p>
        </div>
        <span className="manual-role-summary">
          已标注 {portAnnotations.size} / {portRefNets.length} 个端口
        </span>
      </div>

      {!currentReference ? (
        <p className="muted">请先选择逻辑参考电路。</p>
      ) : null}
      {currentReference && portRefNets.length === 0 ? (
        <p className="muted">
          当前参考电路未声明输入/输出端口，无需端口标注。
          {railRefNets.length > 0
            ? "电源/地由上方电源轨指定即可。"
            : ""}
        </p>
      ) : null}
      {currentReference && portRefNets.length > 0 && currentNets.length === 0 ? (
        <p className="muted">完成 S3 拓扑阶段后即可标注端口。</p>
      ) : null}

      {duplicateLabels.length > 0 ? (
        <div className="bb-warning-panel" role="status">
          {duplicateLabels.map((label) => (
            <p key={label}>{label} 被分配给多个当前网络，请确认。</p>
          ))}
        </div>
      ) : null}

      {missingPortLabels.length > 0 && portRefNets.length > 0 && currentNets.length > 0 ? (
        <div className="bb-warning-panel" role="status">
          以下参考端口尚未标注：{missingPortLabels.join("、")}。未标注的端口角色将由系统从拓扑反推。
        </div>
      ) : null}

      {currentReference && portRefNets.length > 0 && currentNets.length > 0 ? (
        <div className="bb-pin-role-table-wrap">
          <table className="bb-pin-role-table net-role-table">
            <thead>
              <tr>
                <th>当前网络</th>
                <th>连接规模</th>
                <th>当前提示</th>
                <th>参考端口</th>
              </tr>
            </thead>
            <tbody>
              {currentNets.map((net) => {
                const key = portAnnotationKey(net.electricalNetId);
                const annotation = portAnnotations.get(key);
                const selectedNet =
                  portRefNets.find(
                    (refNet) =>
                      referenceNetLabel(refNet).toUpperCase() === (annotation?.label || "").toUpperCase(),
                  )?.net ?? "";
                const conflictedByAdvanced = netRoleAssignmentKeys?.has(key) ?? false;
                return (
                  <tr key={key}>
                    <td className="net-cell">{net.electricalNetId}</td>
                    <td>
                      {net.componentCount} 元件 · {net.holeCount} 孔位
                    </td>
                    <td>
                      {net.powerRole ? <span className="bb-role-tag">{net.powerRole}</span> : null}
                      {annotation?.label ? (
                        <span className={`net-role-badge role-${annotation.role}`}>
                          {annotation.label}
                        </span>
                      ) : net.roleLabel ? (
                        <span className="muted">{net.roleLabel}</span>
                      ) : (
                        <span className="muted">-</span>
                      )}
                      {conflictedByAdvanced ? (
                        <span className="net-role-badge role-output" style={{ marginLeft: 6 }}>
                          已被高级面板覆盖
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <select
                        className="net-role-select"
                        value={selectedNet}
                        onChange={(event) => handleSelect(net, event.target.value)}
                      >
                        <option value="">不标注</option>
                        {portRefNets.map((refNet) => (
                          <option key={refNet.net} value={refNet.net}>
                            {referenceNetLabel(refNet)} · {refNet.role}
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
