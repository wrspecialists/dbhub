import { ConnectorManager } from '../connectors/manager.js';
import { ConnectorRegistry } from '../connectors/interface.js';
import { createToolSuccessResponse } from '../utils/response-formatter.js';

/**
 * list_connectors tool handler
 * Lists all available database connectors and their sample DSNs
 */
export async function listConnectorsToolHandler(_args: {}, _extra: any) {
  const connectors = ConnectorManager.getAvailableConnectors();
  const samples = ConnectorRegistry.getAllSampleDSNs();
  
  // Convert to a more structured format
  const sampleObjects = Object.entries(samples).map(([id, dsn]) => ({ 
    id, 
    dsn 
  }));
  
  // Prepare response data
  const responseData = {
    connectors: sampleObjects,
    count: sampleObjects.length
  };
  
  // Use the utility to create a standardized response
  return createToolSuccessResponse(responseData);
}