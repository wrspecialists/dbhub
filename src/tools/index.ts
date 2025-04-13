import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runQueryToolHandler, runQuerySchema } from './run-query.js';
import { listConnectorsToolHandler } from './list-connectors.js';

/**
 * Register all tool handlers with the MCP server
 */
export function registerTools(server: McpServer): void {
  // Tool to run a SQL query (read-only for safety)
  server.tool(
    "run_query",
    "Run a SQL query on the current database",
    runQuerySchema,
    runQueryToolHandler
  );

  // Tool to list available database connectors
  server.tool(
    "list_connectors",
    "List all available database connectors",
    {},
    listConnectorsToolHandler
  );
}