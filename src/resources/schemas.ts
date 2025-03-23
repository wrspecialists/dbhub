import { ConnectorManager } from '../connectors/manager.js';
import { createResourceSuccessResponse } from '../utils/response-formatter.js';

/**
 * Schemas resource handler
 * Returns a list of all schemas in the database
 */
export async function schemasResourceHandler(uri: URL, _extra: any) {
  const connector = ConnectorManager.getCurrentConnector();
  const schemas = await connector.getSchemas();
  
  // Prepare response data
  const responseData = {
    schemas: schemas,
    count: schemas.length
  };
  
  // Use the utility to create a standardized response
  return createResourceSuccessResponse(uri.href, responseData);
}