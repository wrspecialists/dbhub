import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tablesResourceHandler } from './tables.js';
import { schemaResourceHandler } from './schema.js';
import { schemasResourceHandler } from './schemas.js';

// Export all resource handlers
export { tablesResourceHandler } from './tables.js';
export { schemaResourceHandler } from './schema.js';
export { schemasResourceHandler } from './schemas.js';

/**
 * Register all resource handlers with the MCP server
 */
export function registerResources(server: McpServer): void {
  // Resource for listing all schemas
  server.resource(
    "schemas",
    "db://schemas",
    schemasResourceHandler
  );

  // Resource for listing all tables
  server.resource(
    "tables",
    new ResourceTemplate("db://tables", { list: undefined }),
    tablesResourceHandler
  );

  // Allow listing tables within a specific schema
  server.resource(
    "tables-in-schema",
    new ResourceTemplate("db://schemas/{schemaName}/tables", { list: undefined }),
    tablesResourceHandler
  );

  // Resource for getting table schema
  server.resource(
    "schema",
    new ResourceTemplate("db://schema/{tableName}", { list: undefined }),
    schemaResourceHandler
  );

  // Resource for getting table schema in a specific schema
  server.resource(
    "schema-in-schema",
    new ResourceTemplate("db://schemas/{schemaName}/schema/{tableName}", { list: undefined }),
    schemaResourceHandler
  );
}