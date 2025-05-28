import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeSqlToolHandler, executeSqlSchema } from "./execute-sql.js";
import { listConnectorsToolHandler } from "./list-connectors.js";

/**
 * Generate a random string of specified length
 */
function generateRandomString(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

// Generate tool names with random suffixes when the module is loaded
const EXECUTE_SQL_TOOL_NAME = `execute_sql_${generateRandomString(8)}`;
const LIST_CONNECTORS_TOOL_NAME = `list_connectors_${generateRandomString(8)}`;

/**
 * Register all tool handlers with the MCP server
 */
export function registerTools(server: McpServer): void {
  // Tool to run a SQL query (read-only for safety)
  server.tool(
    EXECUTE_SQL_TOOL_NAME,
    "Execute a SQL query on the current database",
    executeSqlSchema,
    executeSqlToolHandler
  );

  // Tool to list available database connectors
  server.tool(
    LIST_CONNECTORS_TOOL_NAME,
    "List all available database connectors",
    {},
    listConnectorsToolHandler
  );
}

// Export the tool names so they can be accessed from other modules if needed
export { EXECUTE_SQL_TOOL_NAME, LIST_CONNECTORS_TOOL_NAME };
