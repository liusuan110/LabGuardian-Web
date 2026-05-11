import { useReducer } from "react";
import { AgentChat } from "../../components/AgentChat";
import { AppHeader } from "../../components/AppHeader";
import { DiagnosticsPanel } from "../../components/DiagnosticsPanel";
import { MetricStrip } from "../../components/MetricStrip";
import { ModeTabs } from "../../components/ModeTabs";
import { NetlistView } from "../../components/NetlistView";
import { RawJsonPanel } from "../../components/RawJsonPanel";
import { ReferenceSelector } from "../../components/ReferenceSelector";
import { ResultCanvas } from "../../components/ResultCanvas";
import { StageTimeline } from "../../components/StageTimeline";
import { UploadPanel } from "../../components/UploadPanel";
import { recomputeCorrected } from "../../api/pipeline";
import { buildCorrectionPatch } from "../../utils/breadboard";
import { fileToBase64 } from "../../utils/file";
import { getStageData } from "../../utils/pipeline";
import type { PipelineComponent, PipelineResult, EvidenceRef, ComparisonReport } from "../../types/pipeline";
import { demoReducer, initialDemoState } from "./demoReducer";
import { useAgentChat } from "./useAgentChat";
import { useBackendStatus } from "./useBackendStatus";
import { usePipelineRun } from "./usePipelineRun";
import { useReferences } from "./useReferences";

function parseComparisonReport(result: unknown): ComparisonReport | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  if (!("comparison_report" in r)) return null;
  const cr = r.comparison_report;
  if (!cr || typeof cr !== "object") return null;
  return cr as ComparisonReport;
}

const SEVERITY_ORDER: Record<string, number> = {
  fatal: 0,
  error: 1,
  warning: 2,
  info: 3,
};

export function DemoPage() {
  const [state, dispatch] = useReducer(demoReducer, initialDemoState);
  useBackendStatus(dispatch);
  useReferences(dispatch, state.selectedReferenceId);
  const { send } = useAgentChat(state, dispatch);
  const { execute } = usePipelineRun(state, dispatch, send);

  const cr = parseComparisonReport(state.pipelineResult);
  const rawItems = cr?.items ?? [];
  const comparisonItems = [...rawItems].sort((a, b) => {
    const sa = SEVERITY_ORDER[String(a.severity ?? "warning")] ?? 99;
    const sb = SEVERITY_ORDER[String(b.severity ?? "warning")] ?? 99;
    return sa - sb;
  });
  const highlightTargets: EvidenceRef[] =
    state.selectedDiagnosticIndex != null
      ? (comparisonItems[state.selectedDiagnosticIndex]?.evidence_refs ?? [])
      : [];

  async function handleFileSelected(file: File) {
    if (!file.type.startsWith("image/")) {
      dispatch({ type: "run-error", error: "请选择图片文件。" });
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    const base64 = await fileToBase64(file);
    dispatch({ type: "select-file", file, imageUrl, base64 });
  }

  async function handleApplyCorrections() {
    const result = state.pipelineResult;
    if (!result || !("stages" in result) || state.runState === "running") {
      return;
    }

    const components = (getStageData(result, "mapping").components ?? []) as PipelineComponent[];
    const corrections = buildCorrectionPatch(result, state.manualCorrections);
    const netRoleAssignments = Array.from(state.manualNetRoleAssignments.values());
    const pinPolarityAssignments = Array.from(state.manualPinPolarityAssignments.entries()).map(
      ([key, polarity]) => {
        const [component_id, pin_name] = key.split(".", 2);
        return {
          component_id,
          pin_name,
          polarity,
          source: "manual_pin_polarity_select" as const,
        };
      },
    );

    if (components.length === 0) {
      dispatch({ type: "run-error", error: "没有可提交的 mapping components。" });
      return;
    }
    if (corrections.length === 0 && netRoleAssignments.length === 0 && pinPolarityAssignments.length === 0) {
      dispatch({ type: "run-error", error: "请先修改孔位、标注端口语义，或手动指定三极管 E/B/C。" });
      return;
    }

    dispatch({ type: "corrected-recompute-start" });
    try {
      const corrected: PipelineResult = await recomputeCorrected({
        station_id: state.stationId,
        job_id: result.job_id,
        components,
        corrections,
        net_role_assignments: netRoleAssignments,
        pin_polarity_assignments: pinPolarityAssignments,
        rail_assignments: state.rails,
        reference_id: state.selectedReferenceId,
        reference_circuit: null,
      });
      dispatch({ type: "corrected-recompute-success", result: corrected });
    } catch (error) {
      dispatch({
        type: "run-error",
        error: error instanceof Error ? error.message : "修正网表重算失败",
      });
    }
  }

  return (
    <main className="app-shell">
      <AppHeader
        online={state.backendOnline}
        message={state.backendMessage}
        stationId={state.stationId}
        version={state.version}
      />

      <MetricStrip result={state.pipelineResult} />

      {state.error ? <div className="error-banner">{state.error}</div> : null}

      <section className="demo-grid">
        <div className="left-column">
          <UploadPanel
            file={state.file}
            conf={state.conf}
            iou={state.iou}
            imgsz={state.imgsz}
            rails={state.rails}
            runState={state.runState}
            activeStage={state.pipelineProgress.activeStage}
            onFileSelected={handleFileSelected}
            onOptionChange={(key, value) => dispatch({ type: "set-option", key, value })}
            onRailChange={(key, value) => dispatch({ type: "set-rail", key, value })}
            onRun={execute}
          />
          <ReferenceSelector
            references={state.references}
            selectedReferenceId={state.selectedReferenceId}
            status={state.referenceStatus}
            error={state.referenceError}
            currentReference={state.currentReference}
            currentReferenceStatus={state.currentReferenceStatus}
            currentReferenceError={state.currentReferenceError}
            onChange={(referenceId) =>
              dispatch({ type: "select-reference", referenceId })
            }
          />
        </div>

        <section className="main-stage">
          <div className="stage-header">
            <div>
              <p className="eyebrow">Evidence Chain</p>
              <h2>从图像到网表事实链</h2>
            </div>
            <ModeTabs mode={state.activeMode} onChange={(mode) => dispatch({ type: "set-mode", mode })} />
          </div>

          <div className="stage-body">
            {state.activeMode === "netlist" ? (
              <NetlistView
                result={state.pipelineResult}
                corrections={state.manualCorrections}
                onCorrectionChange={(corrections) => dispatch({ type: "set-manual-corrections", corrections })}
                onResetCorrections={() => {
                  dispatch({ type: "reset-manual-corrections" });
                  dispatch({ type: "reset-manual-net-roles" });
                  dispatch({ type: "reset-manual-pin-polarities" });
                }}
                onApplyCorrections={handleApplyCorrections}
                isApplyingCorrections={state.runState === "running"}
                selectedReferenceId={state.selectedReferenceId}
                currentReference={state.currentReference}
                netRoleAssignments={state.manualNetRoleAssignments}
                onNetRoleChange={(key, assignment) =>
                  dispatch({ type: "set-manual-net-role", key, assignment })
                }
                onResetNetRoles={() => dispatch({ type: "reset-manual-net-roles" })}
                highlightTargets={highlightTargets}
                pinPolarityAssignments={state.manualPinPolarityAssignments}
                onPinPolarityChange={(key, polarity) =>
                  dispatch({ type: "set-manual-pin-polarity", key, polarity })
                }
                onResetPinPolarities={() => dispatch({ type: "reset-manual-pin-polarities" })}
              />
            ) : (
              <ResultCanvas imageUrl={state.imageUrl} result={state.pipelineResult} mode={state.activeMode} highlightTargets={highlightTargets} />
            )}
          </div>
        </section>

        <DiagnosticsPanel
          result={state.pipelineResult}
          selectedDiagnosticIndex={state.selectedDiagnosticIndex}
          onSelectDiagnostic={(index) => dispatch({ type: "select-diagnostic", index })}
        />
      </section>

      <AgentChat
        messages={state.chatMessages}
        status={state.agentStatus}
        canSend={Boolean(state.pipelineResult)}
        onSend={(message) => send(message)}
      />

      <section className="bottom-grid">
        <StageTimeline
          result={state.pipelineResult}
          progress={state.pipelineProgress}
          runState={state.runState}
        />
        <RawJsonPanel
          pipeline={state.pipelineResult}
          agent={state.agentResult}
          selectedReferenceId={state.selectedReferenceId}
          runtimeMetadata={state.pipelineResult && "runtime_metadata" in state.pipelineResult ? state.pipelineResult.runtime_metadata : null}
        />
      </section>
    </main>
  );
}
