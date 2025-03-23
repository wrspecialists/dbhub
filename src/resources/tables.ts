import { ConnectorManager } from '../connectors/manager.js';
import { createResourceSuccessResponse } from '../utils/response-formatter.js';

/**
 * Tables resource handler
 * Returns a list of all tables in the database or within a specific schema
 */
export async function tablesResourceHandler(uri: URL, variables: any, _extra: any) {
  const connector = ConnectorManager.getCurrentConnector();
  
  // Extract the schema name from URL variables if present
  const schemaName = variables && variables.schemaName ? 
    (Array.isArray(variables.schemaName) ? variables.schemaName[0] : variables.schemaName) :
    undefined;
  
  // Get tables with optional schema filter
  const tableNames = await connector.getTables(schemaName);
  
  // Prepare response data
  const responseData = {
    tables: tableNames,
    count: tableNames.length,
    schema: schemaName
  };
  
  // Use the utility to create a standardized response
  return createResourceSuccessResponse(uri.href, responseData);
}