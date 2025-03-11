import { ConnectorManager } from '../connectors/manager.js';
import { ConnectorRegistry } from '../interfaces/connector.js';

/**
 * List-connectors tool handler
 * Lists all available database connectors and their sample DSNs
 */
export async function listConnectorsToolHandler(_args: {}, _extra: any) {
  const connectors = ConnectorManager.getAvailableConnectors();
  const samples = ConnectorRegistry.getAllSampleDSNs();
  
  const formattedSamples = Object.entries(samples)
    .map(([id, dsn]) => `${id}: ${dsn}`)
    .join('\n');
  
  return {
    content: [{ 
      type: "text" as const, 
      text: `Available database connectors:\n\n${formattedSamples}`
    }]
  };
}