import { ConnectorManager } from "../connectors/manager.js";
import { ConnectorRegistry } from "../connectors/interface.js";
import { createToolSuccessResponse } from "../utils/response-formatter.js";
import { isDemoMode } from "../config/env.js";

/**
 * list_connectors tool handler
 * Lists all available database connectors and their sample DSNs
 * Indicates which connector is active based on current DSN
 */
export async function listConnectorsToolHandler(_args: {}, _extra: any) {
  const samples = ConnectorRegistry.getAllSampleDSNs();

  // Get active connector if possible
  let activeConnectorType: string | null = null;
  try {
    // Check if we have an active connection using static method
    const activeConnector = ConnectorManager.getCurrentConnector();
    activeConnectorType = activeConnector.id;
  } catch (error) {
    // No active connector yet or not connected
  }

  // If we're in demo mode, SQLite should be active
  const isDemo = isDemoMode();
  if (isDemo && !activeConnectorType) {
    activeConnectorType = "sqlite";
  }

  // Convert to a more structured format
  const sampleObjects = Object.entries(samples).map(([id, dsn]) => ({
    id,
    dsn,
    active: id === activeConnectorType,
  }));

  // Prepare response data
  const responseData = {
    connectors: sampleObjects,
    count: sampleObjects.length,
    activeConnector: activeConnectorType,
    demoMode: isDemo,
  };

  // Use the utility to create a standardized response
  return createToolSuccessResponse(responseData);
}
