import { z } from "zod";
import { ConnectorManager } from '../connectors/manager.js';

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
      return {
        content: [{ 
          type: "text" as const, 
          text: `Query validation failed: ${validationResult.message ?? "Unknown error"}`
        }],
        isError: true
      };
    }
    
    // Execute the query if validation passed
    const result = await connector.executeQuery(query);
    
    // Build response, including any warnings from validation
    let responseText = JSON.stringify(result.rows, null, 2);
    
    return {
      content: [{ 
        type: "text" as const, 
        text: responseText
      }]
    };
  } catch (error) {
    return {
      content: [{ 
        type: "text" as const, 
        text: `Error executing query: ${(error as Error).message}`
      }],
      isError: true
    };
  }
}