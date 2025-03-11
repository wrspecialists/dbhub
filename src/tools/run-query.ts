import { z } from "zod";
import { ConnectorManager } from '../connectors/manager.js';
import { createToolSuccessResponse, createToolErrorResponse } from '../utils/response-formatter.js';

// Schema for run-query tool
export const runQuerySchema = { 
  query: z.string().describe("SQL query to execute (SELECT only)")
};

/**
 * Run-query tool handler
 * Executes a SQL query and returns the results
 */
export async function runQueryToolHandler({ query }: { query: string }, _extra: any) {
  const connector = ConnectorManager.getCurrentConnector();
  
  try {
    // Validate the query before execution
    const validationResult = connector.validateQuery(query);
    
    if (!validationResult.isValid) {
      return createToolErrorResponse(
        validationResult.message ?? "Unknown validation error",
        "VALIDATION_ERROR"
      );
    }
    
    // Execute the query if validation passed
    const result = await connector.executeQuery(query);
    
    // Build response data
    const responseData = {
      rows: result.rows,
      count: result.rows.length
    };
    
    return createToolSuccessResponse(responseData);
  } catch (error) {
    return createToolErrorResponse(
      (error as Error).message,
      "EXECUTION_ERROR"
    );
  }
}