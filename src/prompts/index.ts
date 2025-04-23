import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sqlGeneratorPromptHandler, sqlGeneratorSchema } from "./sql-generator.js";
import { dbExplainerPromptHandler, dbExplainerSchema } from "./db-explainer.js";

/**
 * Register all prompt handlers with the MCP server
 */
export function registerPrompts(server: McpServer): void {
  // Register SQL Generator prompt
  server.prompt(
    "generate_sql",
    "Generate SQL queries from natural language descriptions",
    sqlGeneratorSchema,
    sqlGeneratorPromptHandler
  );

  // Register Database Explainer prompt
  server.prompt(
    "explain_db",
    "Get explanations about database tables, columns, and structures",
    dbExplainerSchema,
    dbExplainerPromptHandler
  );
}
