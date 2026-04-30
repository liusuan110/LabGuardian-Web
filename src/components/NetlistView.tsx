import type { PipelineResult, CircuitAnalysisResult, PortVisualizationResult } from "../types/pipeline";
import { getStageData } from "../utils/pipeline";

type Props = {
  result: PipelineResult | CircuitAnalysisResult | PortVisualizationResult | null;
};

const NET_COLORS = [
  "#14796b", "#2563eb", "#b7791f", "#be3144", "#7b1fa2", 
  "#4caf50", "#ff5722", "#00bcd4", "#ff9800", "#e91e63",
  "#607d8b", "#8bc34a", "#ffc107", "#03a9f4", "#9c27b0"
];

function getNetColor(netId: string): string {
  let hash = 0;
  for (let i = 0; i < netId.length; i++) {
    hash = netId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return NET_COLORS[Math.abs(hash) % NET_COLORS.length];
}

export function NetlistView({ result }: Props) {
  const isPortVisualization = result && "ports" in result && result.ports.length > 0;
  const isCircuitAnalysis = result && "components" in result && result.components.length > 0;

  if (!result) {
    return <div className="empty-stage compact">网表将在 S3 拓扑阶段完成后显示。</div>;
  }

  if (isPortVisualization) {
    return <PortVisualizationView result={result as PortVisualizationResult} />;
  }

  if (isCircuitAnalysis) {
    return <CircuitAnalysisNetlistView result={result as CircuitAnalysisResult} />;
  }

  return <PipelineNetlistView result={result as PipelineResult} />;
}

function PipelineNetlistView({ result }: { result: PipelineResult }) {
  const mappingData = getStageData(result, "mapping");
  
  const components = mappingData.components as Array<{
    component_id?: string;
    component_type?: string;
    pins?: Array<{
      pin_id?: number;
      pin_name?: string;
      hole_id?: string;
      electrical_node_id?: string;
    }>;
  }> || [];

  const nodeToPins = new Map<string, Array<{
    component_id: string;
    component_type: string;
    pin_id: number;
    pin_name: string;
    hole_id: string;
  }>>();

  components.forEach(comp => {
    comp.pins?.forEach(pin => {
      const nodeId = pin.electrical_node_id || "UNKNOWN";
      if (!nodeToPins.has(nodeId)) {
        nodeToPins.set(nodeId, []);
      }
      nodeToPins.get(nodeId)?.push({
        component_id: comp.component_id || "unknown",
        component_type: comp.component_type || "unknown",
        pin_id: pin.pin_id || 0,
        pin_name: pin.pin_name || `pin${pin.pin_id}`,
        hole_id: pin.hole_id || "-",
      });
    });
  });

  const sortedNodes = Array.from(nodeToPins.entries()).sort((a, b) => {
    const aIsPower = a[0].toUpperCase().includes("VCC") || a[0].toUpperCase().includes("GND");
    const bIsPower = b[0].toUpperCase().includes("VCC") || b[0].toUpperCase().includes("GND");
    if (aIsPower && !bIsPower) return -1;
    if (!aIsPower && bIsPower) return 1;
    return a[0].localeCompare(b[0]);
  });

  if (components.length === 0) {
    return (
      <section className="netlist-panel">
        <div className="panel-heading">
          <h2>网表</h2>
        </div>
        <p className="muted">等待 S3 拓扑阶段完成...</p>
      </section>
    );
  }

  return (
    <section className="netlist-panel">
      <div className="panel-heading">
        <h2>电气连接关系</h2>
        <span>{nodeToPins.size} 个节点</span>
      </div>

      <div className="electrical-connections">
        <div className="connection-list">
          {sortedNodes.map(([nodeId, pins]) => {
            if (pins.length < 1) return null;
            const netColor = getNetColor(nodeId);
            
            return (
              <div 
                key={nodeId} 
                className="connection-group"
                style={{ borderLeftColor: netColor }}
              >
                <div className="connection-header">
                  <div className="net-dot" style={{ backgroundColor: netColor }}></div>
                  <span className="net-label">{nodeId}</span>
                  {nodeId.toUpperCase().includes("VCC") && (
                    <span className="power-tag vcc">VCC</span>
                  )}
                  {nodeId.toUpperCase().includes("GND") && (
                    <span className="power-tag gnd">GND</span>
                  )}
                </div>
                <div className="connected-pins">
                  {pins.map((pin, idx) => (
                    <div key={idx} className="connected-pin">
                      <span className="comp-ref">{pin.component_id}</span>
                      <span className="pin-ref">{pin.pin_name}</span>
                      <span className="hole-ref">@{pin.hole_id}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PortVisualizationView({ result }: { result: PortVisualizationResult }) {
  return (
    <section className="netlist-panel">
      <div className="panel-heading">
        <h2>端口可视化网表</h2>
        <span>{result.port_count} ports · {result.net_count} nets</span>
      </div>
      <div className="pin-coordinate-list">
        {result.components.map(comp => {
          const compPorts = result.ports.filter(p => p.component_id === comp.component_id);
          return (
            <div key={comp.component_id} className="pin-coordinate-card">
              <div className="component-header">
                <span className="component-id">{comp.component_id}</span>
                <span className="component-type">{comp.component_type}</span>
              </div>
              <div className="pins-container">
                {compPorts.map(port => (
                  <div key={port.pin_id} className="pin-item">
                    <span className="pin-name">{port.pin_name || `pin${port.pin_id}`}</span>
                    <span className="arrow">→</span>
                    <span className="hole-coord">{`${port.col_name}${port.row_number}`}</span>
                    {port.net_id && (
                      <>
                        <span className="arrow">→</span>
                        <span className="net-id">{port.net_id}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CircuitAnalysisNetlistView({ result }: { result: CircuitAnalysisResult }) {
  const netToComponents = new Map<string, string[]>();
  
  result.components.forEach(comp => {
    comp.pins.forEach(pin => {
      if (pin.electrical_net_id) {
        if (!netToComponents.has(pin.electrical_net_id)) {
          netToComponents.set(pin.electrical_net_id, []);
        }
        if (!netToComponents.get(pin.electrical_net_id)?.includes(comp.component_id)) {
          netToComponents.get(pin.electrical_net_id)?.push(comp.component_id);
        }
      }
    });
  });

  const nodeToPins = new Map<string, Array<{
    component_id: string;
    component_type: string;
    pin_id: number;
    pin_name: string;
    hole_id: string;
  }>>();

  result.components.forEach(comp => {
    comp.pins.forEach(pin => {
      const nodeId = pin.electrical_net_id || "UNKNOWN";
      if (!nodeToPins.has(nodeId)) {
        nodeToPins.set(nodeId, []);
      }
      nodeToPins.get(nodeId)?.push({
        component_id: comp.component_id || "unknown",
        component_type: comp.component_type || "unknown",
        pin_id: pin.pin_id || 0,
        pin_name: pin.pin_name || `pin${pin.pin_id}`,
        hole_id: pin.hole_id || "-",
      });
    });
  });

  const sortedNodes = Array.from(nodeToPins.entries()).sort((a, b) => {
    const aIsPower = a[0].toUpperCase().includes("VCC") || a[0].toUpperCase().includes("GND");
    const bIsPower = b[0].toUpperCase().includes("VCC") || b[0].toUpperCase().includes("GND");
    if (aIsPower && !bIsPower) return -1;
    if (!aIsPower && bIsPower) return 1;
    return a[0].localeCompare(b[0]);
  });

  return (
    <section className="netlist-panel">
      <div className="panel-heading">
        <h2>电气连接关系</h2>
        <span>{nodeToPins.size} 个节点</span>
      </div>

      <div className="electrical-connections">
        <div className="connection-list">
          {sortedNodes.map(([nodeId, pins]) => {
            if (pins.length < 1) return null;
            const netColor = getNetColor(nodeId);
            
            return (
              <div 
                key={nodeId} 
                className="connection-group"
                style={{ borderLeftColor: netColor }}
              >
                <div className="connection-header">
                  <div className="net-dot" style={{ backgroundColor: netColor }}></div>
                  <span className="net-label">{nodeId}</span>
                  {nodeId.toUpperCase().includes("VCC") && (
                    <span className="power-tag vcc">VCC</span>
                  )}
                  {nodeId.toUpperCase().includes("GND") && (
                    <span className="power-tag gnd">GND</span>
                  )}
                </div>
                <div className="connected-pins">
                  {pins.map((pin, idx) => (
                    <div key={idx} className="connected-pin">
                      <span className="comp-ref">{pin.component_id}</span>
                      <span className="pin-ref">{pin.pin_name}</span>
                      <span className="hole-ref">@{pin.hole_id}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}