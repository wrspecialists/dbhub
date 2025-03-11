import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tablesResourceHandler } from './tables.js';
import { schemaResourceHandler } from './schema.js';

/**
 * Register all resource handlers with the MCP server
 */
export function registerResources(server: McpServer): void {
  // Resource for listing all tables
  server.resource(
    "tables",
    "db://tables",
    tablesResourceHandler
  );

  // Resource for getting table schema
  server.resource(
    "schema",
    new ResourceTemplate("db://schema/{tableName}", { list: undefined }),
    schemaResourceHandler
  );
}