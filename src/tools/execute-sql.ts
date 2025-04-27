import { z } from "zod";
import { ConnectorManager } from "../connectors/manager.js";
import { createToolSuccessResponse, createToolErrorResponse } from "../utils/response-formatter.js";
import { isReadOnlyMode } from "../config/env.js";
import { allowedKeywords } from "../utils/allowed-keywords.js";
import { ConnectorType } from "../connectors/interface.js";

// Schema for execute_sql tool
export const executeSqlSchema = {
  sql: z.string().describe("SQL query to execute (SELECT only)"),
};

/**
 * Check if a SQL query is read-only based on its first keyword
 * @param sql The SQL query to check
 * @param connectorType The database type to check against
 * @returns True if the query is read-only (starts with allowed keywords)
 */
function isReadOnlySQL(sql: string, connectorType: ConnectorType): boolean {
  const normalizedSQL = sql.trim().toLowerCase();
  const firstWord = normalizedSQL.split(/\s+/)[0];
  
  // Get the appropriate allowed keywords list for this database type
  const keywordList = allowedKeywords[connectorType] || allowedKeywords.default || [];
  
  return keywordList.includes(firstWord);
}

/**
 * execute_sql tool handler
 * Executes a SQL query and returns the results
 */
export async function executeSqlToolHandler({ sql }: { sql: string }, _extra: any) {
  const connector = ConnectorManager.getCurrentConnector();

  try {
    // Check if SQL is allowed based on readonly mode
    if (isReadOnlyMode() && !isReadOnlySQL(sql, connector.id)) {
      return createToolErrorResponse(
        `Read-only mode is enabled. Only the following SQL operations are allowed: ${allowedKeywords[connector.id]?.join(", ") || "none"}`,
        "READONLY_VIOLATION"
      );
    }
    // Execute the SQL query if validation passed
    const result = await connector.executeSQL(sql);

    // Build response data
    const responseData = {
      rows: result.rows,
      count: result.rows.length,
    };

    return createToolSuccessResponse(responseData);
  } catch (error) {
    return createToolErrorResponse((error as Error).message, "EXECUTION_ERROR");
  }
}
