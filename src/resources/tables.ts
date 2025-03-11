import { ConnectorManager } from '../connectors/manager.js';
import { createResourceSuccessResponse } from '../utils/response-formatter.js';

/**
 * Tables resource handler
 * Returns a list of all tables in the database
 */
export async function tablesResourceHandler(uri: URL, _extra: any) {
  const connector = ConnectorManager.getCurrentConnector();
  const tableNames = await connector.getTables();
  
  // Prepare response data
  const responseData = {
    tables: tableNames,
    count: tableNames.length
  };
  
  // Use the utility to create a standardized response
  return createResourceSuccessResponse(uri.href, responseData);
}