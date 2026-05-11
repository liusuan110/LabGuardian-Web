import type {
  CircuitAnalysisResult,
  LogicalReference,
  LogicalReferenceNet,
  ManualNetRoleAssignment,
  PipelineResult,
  PortVisualizationResult,
} from "../types/pipeline";
import { getStageData } from "../utils/pipeline";
import {
  isCriticalReferenceNet,
  normalizeReferenceRole,
  referenceNetLabel,
  referenceNetOptionLabel,
} from "../utils/referenceRoles";

type Props = {
  result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null;
  currentReference: LogicalReference | null;
  netRoleAssignments: Map<string, ManualNetRoleAssignment>;
  onNetRoleChange: (key: string, assignment: ManualNetRoleAssignment | null) => void;
  onResetNetRoles: () => void;
  onApplyCorrections: () => void;
  isApplyingCorrections?: boolean;
};

type CurrentNetRow = {
  electricalNetId: string;
  powerRole?: string;
  roleLabel?: string;
  componentCount: number;
  holeCount: number;
  nodeCount: number;
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
          nodeCount: Array.isArray(record.nodes) ? record.nodes.length : 0,
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
          nodeCount: Array.isArray(record.member_node_ids)
            ? record.member_node_ids.length
            : Array.isArray(record.member_port_ids)
              ? record.member_port_ids.length
              : 0,
        },
      ];
    });
  }

  return [];
}

function buildAssignment(refNet: LogicalReferenceNet, electricalNetId: string): ManualNetRoleAssignment {
  const roleLabel = referenceNetLabel(refNet);
  return {
    role: normalizeReferenceRole(refNet.role, roleLabel),
    role_label: roleLabel,
    electrical_net_id: electricalNetId,
    source: "manual_netlist_select",
  };
}

export function NetRoleAssignmentPanel({
  result,
  currentReference,
  netRoleAssignments,
  onNetRoleChange,
  onResetNetRoles,
  onApplyCorrections,
  isApplyingCorrections = false,
}: Props) {
  const currentNets = getCurrentNets(result);
  const referenceNets = currentReference?.nets ?? [];
  const assignedLabels = Array.from(netRoleAssignments.values()).flatMap((assignment) =>
    assignment.role_label ? [assignment.role_label] : [],
  );
  const duplicateLabels = Array.from(
    assignedLabels.reduce((counts, label) => counts.set(label, (counts.get(label) ?? 0) + 1), new Map<string, number>()),
  )
    .filter(([, count]) => count > 1)
    .map(([label]) => label);
  const assignedLabelSet = new Set(assignedLabels);
  const missingCriticalLabels = Array.from(
    new Set(
      referenceNets
        .filter(isCriticalReferenceNet)
        .map(referenceNetLabel)
        .filter((label) => !assignedLabelSet.has(label)),
    ),
  );

  function handleSelect(currentNet: CurrentNetRow, refNetName: string) {
    const key = `net:${currentNet.electricalNetId}`;
    if (!refNetName) {
      onNetRoleChange(key, null);
      return;
    }
    const refNet = referenceNets.find((item) => item.net === refNetName);
    if (!refNet) return;
    onNetRoleChange(key, buildAssignment(refNet, currentNet.electricalNetId));
  }

  return (
    <section className="net-role-panel">
      <div className="panel-heading">
        <div>
          <h2>端口语义标注</h2>
          <p className="muted">
            将当前识别出的 electrical_net_id 标注为参考网络。UI1、UO1、VEE 等是 role_label，role 只保留 input/output/power/ground/signal。
          </p>
        </div>
        <span className="manual-role-summary">
          已标注 {netRoleAssignments.size} / {currentNets.length} 个网络
        </span>
      </div>

      {!currentReference ? (
        <p className="muted">请选择逻辑参考电路后再进行端口语义标注。</p>
      ) : null}
      {currentReference && currentNets.length === 0 ? (
        <p className="muted">当前结果中还没有 topology netlist_v2.nets，完成 S3 拓扑阶段后可标注。</p>
      ) : null}

      {duplicateLabels.length > 0 ? (
        <div className="bb-warning-panel" role="status">
          {duplicateLabels.map((label) => (
            <p key={label}>{label} 已被分配给多个当前网络，请确认。</p>
          ))}
        </div>
      ) : null}

      {missingCriticalLabels.length > 0 ? (
        <div className="bb-warning-panel" role="status">
          以下参考端口尚未标注：{missingCriticalLabels.join("、")}。缺失标注不阻止提交，但比较结果可能不稳定。
        </div>
      ) : null}

      {currentReference && currentNets.length > 0 ? (
        <div className="bb-pin-role-table-wrap">
          <table className="bb-pin-role-table net-role-table">
            <thead>
              <tr>
                <th>当前网络</th>
                <th>连接规模</th>
                <th>当前提示</th>
                <th>参考网络</th>
              </tr>
            </thead>
            <tbody>
              {currentNets.map((net) => {
                const key = `net:${net.electricalNetId}`;
                const assignment = netRoleAssignments.get(key);
                const selectedNet =
                  referenceNets.find((refNet) => referenceNetLabel(refNet) === assignment?.role_label)?.net ?? "";
                return (
                  <tr key={key}>
                    <td className="net-cell">{net.electricalNetId}</td>
                    <td>
                      {net.componentCount} 元件 · {net.holeCount} 孔位 · {net.nodeCount} 节点
                    </td>
                    <td>
                      {net.powerRole ? <span className="bb-role-tag">{net.powerRole}</span> : null}
                      {assignment?.role_label ? (
                        <span className={`net-role-badge role-${assignment.role}`}>
                          {assignment.role_label}
                        </span>
                      ) : net.roleLabel ? (
                        <span className="muted">{net.roleLabel}</span>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </td>
                    <td>
                      <select
                        className="net-role-select"
                        value={selectedNet}
                        onChange={(event) => handleSelect(net, event.target.value)}
                      >
                        <option value="">不标注</option>
                        {referenceNets.map((refNet) => (
                          <option key={refNet.net} value={refNet.net}>
                            {referenceNetOptionLabel(refNet)}
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
          onClick={onApplyCorrections}
          disabled={netRoleAssignments.size === 0 || isApplyingCorrections}
        >
          {isApplyingCorrections ? "正在重新比较..." : "应用端口语义标注并重新比较"}
        </button>
        {netRoleAssignments.size > 0 ? (
          <button type="button" className="bb-reset-btn" onClick={onResetNetRoles}>
            重置端口语义标注
          </button>
        ) : null}
      </div>
    </section>
  );
}
