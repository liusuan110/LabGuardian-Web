import type { CircuitAnalysisResult, PipelineResult, PortVisualizationResult, ManualNetRoleAssignment, EvidenceRef } from "../types/pipeline";
import { BreadboardView } from "./BreadboardView";

type Props = {
  result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null;
  corrections: Map<string, string>;
  onCorrectionChange: (corrections: Map<string, string>) => void;
  onResetCorrections: () => void;
  onApplyCorrections: () => void;
  isApplyingCorrections?: boolean;
  selectedReferenceId?: string | null;
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
  netRoleAssignments,
  onNetRoleChange,
  onResetNetRoles,
  highlightTargets,
  pinPolarityAssignments,
  onPinPolarityChange,
  onResetPinPolarities,
}: Props) {
  return (
    <BreadboardView
      result={result}
      corrections={corrections}
      onCorrectionChange={onCorrectionChange}
      onResetCorrections={onResetCorrections}
      onApplyCorrections={onApplyCorrections}
      isApplyingCorrections={isApplyingCorrections}
      selectedReferenceId={selectedReferenceId}
      netRoleAssignments={netRoleAssignments}
      onNetRoleChange={onNetRoleChange}
      onResetNetRoles={onResetNetRoles}
      highlightTargets={highlightTargets}
      pinPolarityAssignments={pinPolarityAssignments}
      onPinPolarityChange={onPinPolarityChange}
      onResetPinPolarities={onResetPinPolarities}
    />
  );
}
