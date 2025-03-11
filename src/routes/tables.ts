import { ConnectorManager } from '../connectors/manager.js';

/**
 * Tables resource handler
 * Returns a list of all tables in the database
 */
export async function tablesResourceHandler(uri: URL, _extra: any) {
  const connector = ConnectorManager.getCurrentConnector();
  const tableNames = await connector.getTables();
  
  return {
    contents: [{
      uri: uri.href,
      text: `Available tables:\n\n${tableNames.join('\n')}`
    }]
  };
}