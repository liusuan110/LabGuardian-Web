import type {
  CircuitAnalysisResult,
  PipelineResult,
  PortAnnotation,
  PortVisualizationResult,
  ManualNetRoleAssignment,
  EvidenceRef,
  LogicalReference,
} from "../types/pipeline";
import { BreadboardView } from "./BreadboardView";
import { NetRoleAssignmentPanel } from "./NetRoleAssignmentPanel";

type Props = {
  result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null;
  corrections: Map<string, string>;
  onCorrectionChange: (corrections: Map<string, string>) => void;
  onResetCorrections: () => void;
  onApplyCorrections: () => void;
  isApplyingCorrections?: boolean;
  selectedReferenceId?: string | null;
  currentReference?: LogicalReference | null;
  portAnnotations?: Map<string, PortAnnotation>;
  onPortAnnotationChange?: (key: string, annotation: PortAnnotation | null) => void;
  onResetPortAnnotations?: () => void;
  netRoleAssignments?: Map<string, ManualNetRoleAssignment>;
  onNetRoleChange?: (key: string, assignment: ManualNetRoleAssignment | null) => void;
  onResetNetRoles?: () => void;
  highlightTargets?: EvidenceRef[];
  pinPolarityAssignments?: Map<string, "E" | "B" | "C">;
  onPinPolarityChange?: (key: string, polarity: "E" | "B" | "C" | null) => void;
  onResetPinPolarities?: () => void;
};

/**
 * 网表视图：统一以面包板示意图呈现。同一 net 的孔被高亮、连线、颜色一致；
 * 鼠标悬停孔位查看挂载的元件/引脚；点击 / 悬停图例可单独聚焦某条 net。
 */
export function NetlistView({
  result,
  corrections,
  onCorrectionChange,
  onResetCorrections,
  onApplyCorrections,
  isApplyingCorrections,
  selectedReferenceId,
  currentReference = null,
  portAnnotations,
  onPortAnnotationChange,
  onResetPortAnnotations,
  netRoleAssignments,
  onNetRoleChange,
  onResetNetRoles,
  highlightTargets,
  pinPolarityAssignments,
  onPinPolarityChange,
  onResetPinPolarities,
}: Props) {
  const ports = portAnnotations ?? new Map<string, PortAnnotation>();
  const roles = netRoleAssignments ?? new Map<string, ManualNetRoleAssignment>();

  return (
    <>
      {onNetRoleChange && onResetNetRoles ? (
        <details className="net-role-advanced">
          <summary>
            <span>高级：网络角色全标注（可选）</span>
            <span className="muted">已标注 {roles.size} 个网络</span>
          </summary>
          <p className="muted" style={{ padding: "4px 8px 0" }}>
            一般情况下只需上方端口标注；当系统对内部网络推断不正确时，可以在这里手动指定任意网络角色，会覆盖系统推断。
          </p>
          <NetRoleAssignmentPanel
            result={result}
            currentReference={currentReference}
            netRoleAssignments={roles}
            onNetRoleChange={onNetRoleChange}
            onResetNetRoles={onResetNetRoles}
            onApplyCorrections={onApplyCorrections}
            isApplyingCorrections={isApplyingCorrections}
          />
        </details>
      ) : null}
      <BreadboardView
        result={result}
        corrections={corrections}
        onCorrectionChange={onCorrectionChange}
        onResetCorrections={onResetCorrections}
        onApplyCorrections={onApplyCorrections}
        isApplyingCorrections={isApplyingCorrections}
        selectedReferenceId={selectedReferenceId}
        currentReference={currentReference}
        portAnnotations={ports}
        onPortAnnotationChange={onPortAnnotationChange}
        onResetPortAnnotations={onResetPortAnnotations}
        netRoleAssignments={roles}
        onNetRoleChange={onNetRoleChange}
        onResetNetRoles={onResetNetRoles}
        highlightTargets={highlightTargets}
        pinPolarityAssignments={pinPolarityAssignments}
        onPinPolarityChange={onPinPolarityChange}
        onResetPinPolarities={onResetPinPolarities}
      />
    </>
  );
}
