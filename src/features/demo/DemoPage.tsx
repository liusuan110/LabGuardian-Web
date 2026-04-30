import { useReducer } from "react";
import { AgentChat } from "../../components/AgentChat";
import { AppHeader } from "../../components/AppHeader";
import { DiagnosticsPanel } from "../../components/DiagnosticsPanel";
import { MetricStrip } from "../../components/MetricStrip";
import { ModeTabs } from "../../components/ModeTabs";
import { NetlistView } from "../../components/NetlistView";
import { RawJsonPanel } from "../../components/RawJsonPanel";
import { ResultCanvas } from "../../components/ResultCanvas";
import { StageTimeline } from "../../components/StageTimeline";
import { UploadPanel } from "../../components/UploadPanel";
import { fileToBase64 } from "../../utils/file";
import { demoReducer, initialDemoState } from "./demoReducer";
import { useAgentChat } from "./useAgentChat";
import { useBackendStatus } from "./useBackendStatus";
import { usePipelineRun } from "./usePipelineRun";

export function DemoPage() {
  const [state, dispatch] = useReducer(demoReducer, initialDemoState);
  useBackendStatus(dispatch);
  const { send } = useAgentChat(state, dispatch);
  const { execute } = usePipelineRun(state, dispatch, send);

  async function handleFileSelected(file: File) {
    if (!file.type.startsWith("image/")) {
      dispatch({ type: "run-error", error: "请选择图片文件。" });
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    const base64 = await fileToBase64(file);
    dispatch({ type: "select-file", file, imageUrl, base64 });
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
        <UploadPanel
          file={state.file}
          conf={state.conf}
          iou={state.iou}
          imgsz={state.imgsz}
          rails={state.rails}
          runState={state.runState}
          onFileSelected={handleFileSelected}
          onOptionChange={(key, value) => dispatch({ type: "set-option", key, value })}
          onRailChange={(key, value) => dispatch({ type: "set-rail", key, value })}
          onRun={execute}
        />

        <section className="main-stage">
          <div className="stage-header">
            <div>
              <p className="eyebrow">Evidence Chain</p>
              <h2>从图像到网表事实链</h2>
            </div>
            <ModeTabs mode={state.activeMode} onChange={(mode) => dispatch({ type: "set-mode", mode })} />
          </div>

          {state.activeMode === "netlist" ? (
            <NetlistView result={state.pipelineResult} />
          ) : (
            <ResultCanvas imageUrl={state.imageUrl} result={state.pipelineResult} mode={state.activeMode} />
          )}
        </section>

        <DiagnosticsPanel result={state.pipelineResult} />
      </section>

      <AgentChat
        messages={state.chatMessages}
        status={state.agentStatus}
        canSend={Boolean(state.pipelineResult)}
        onSend={(message) => send(message)}
      />

      <section className="bottom-grid">
        <StageTimeline result={state.pipelineResult} />
        <RawJsonPanel
          pipeline={state.pipelineResult}
          agent={state.agentResult}
          runtimeMetadata={state.pipelineResult && "runtime_metadata" in state.pipelineResult ? state.pipelineResult.runtime_metadata : null}
        />
      </section>
    </main>
  );
}
