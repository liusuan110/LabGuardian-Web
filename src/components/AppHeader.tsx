import { Activity, Cpu, Server, WifiOff } from "lucide-react";
import type { VersionInfo } from "../types/pipeline";

type Props = {
  online: boolean;
  message: string;
  stationId: string;
  version: VersionInfo | null;
};

export function AppHeader({ online, message, stationId, version }: Props) {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">LabGuardian</p>
        <h1>面包板电路智能诊断</h1>
      </div>
      <div className="header-cluster">
        <div className={`status-chip ${online ? "online" : "offline"}`}>
          {online ? <Server size={16} /> : <WifiOff size={16} />}
          <span>{message}</span>
        </div>
        <div className="meta-chip">
          <Activity size={16} />
          <span>{stationId}</span>
        </div>
        <div className="meta-chip">
          <Cpu size={16} />
          <span>{String(version?.code_version ?? "dev")}</span>
        </div>
      </div>
    </header>
  );
}
