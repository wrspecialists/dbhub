import { ConnectorManager } from '../connectors/manager.js';
import { Variables } from '@modelcontextprotocol/sdk/shared/uriTemplate.js';

/**
 * Schema resource handler
 * Returns schema information for a specific table
 */
export async function schemaResourceHandler(uri: URL, variables: Variables, _extra: any) {
  const connector = ConnectorManager.getCurrentConnector();
  // Handle tableName which could be a string or string array from URL template
  const tableName = Array.isArray(variables.tableName) 
    ? variables.tableName[0] 
    : variables.tableName as string;
  
  try {
    // If table doesn't exist, getTableSchema will throw an error
    const columns = await connector.getTableSchema(tableName);
    
    // Format schema information
    const schemaInfo = columns.map(col => 
      `${col.column_name} ${col.data_type} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}${col.column_default ? ` DEFAULT ${col.column_default}` : ''}`
    ).join('\n');
    
    return {
      contents: [{
        uri: uri.href,
        text: `Schema for table '${tableName}':\n\n${schemaInfo}`
      }]
    };
  } catch (error) {
    throw new Error(`Table '${tableName}' does not exist or cannot be accessed`);
  }
}