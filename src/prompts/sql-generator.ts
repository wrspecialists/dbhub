import { z } from "zod";
import { ConnectorManager } from '../connectors/manager.js';
import { formatPromptSuccessResponse, formatPromptErrorResponse } from '../utils/response-formatter.js';

// Schema for SQL generator prompt
export const sqlGeneratorSchema = {
  description: z.string().describe("Natural language description of the SQL query to generate"),
  dialect: z.enum(["postgres", "sqlite"]).optional().describe("SQL dialect to use (optional)")
};

/**
 * SQL Generator Prompt Handler
 * Generates SQL queries from natural language descriptions
 */
export async function sqlGeneratorPromptHandler({ description, dialect }: {
  description: string;
  dialect?: "postgres" | "sqlite";
}, _extra: any) {
  try {
    // Get current connector to determine dialect if not specified
    const connector = ConnectorManager.getCurrentConnector();
    
    // Determine SQL dialect from connector if not explicitly provided
    const sqlDialect = dialect || 
      (connector.id === 'postgres' ? 'postgres' : 
      (connector.id === 'sqlite' ? 'sqlite' : 'postgres'));
    
    // Get schema information to help with table/column references
    const tables = await connector.getTables();
    const tableSchemas = await Promise.all(
      tables.map(async (table) => {
        try {
          const columns = await connector.getTableSchema(table);
          return {
            table,
            columns: columns.map(col => ({
              name: col.column_name,
              type: col.data_type
            }))
          };
        } catch (error) {
          // Skip tables we can't access
          return null;
        }
      })
    );
    
    // Filter out null entries (tables we couldn't access)
    const accessibleSchemas = tableSchemas.filter(schema => schema !== null);
    
    // Generate a schema description for context
    const schemaContext = accessibleSchemas.length > 0 
      ? `Available tables and their columns:\n${accessibleSchemas.map(schema => 
          `- ${schema!.table}: ${schema!.columns.map(col => 
            `${col.name} (${col.type})`
          ).join(', ')}`
        ).join('\n')}`
      : 'No schema information available.';
    
    // Example queries for the given dialect to use as reference
    const dialectExamples = {
      postgres: [
        "SELECT * FROM users WHERE created_at > NOW() - INTERVAL '1 day'",
        "SELECT u.name, COUNT(o.id) FROM users u JOIN orders o ON u.id = o.user_id GROUP BY u.name HAVING COUNT(o.id) > 5",
        "SELECT product_name, price FROM products WHERE price > (SELECT AVG(price) FROM products)"
      ],
      sqlite: [
        "SELECT * FROM users WHERE created_at > datetime('now', '-1 day')",
        "SELECT u.name, COUNT(o.id) FROM users u JOIN orders o ON u.id = o.user_id GROUP BY u.name HAVING COUNT(o.id) > 5",
        "SELECT product_name, price FROM products WHERE price > (SELECT AVG(price) FROM products)"
      ]
    };
    
    // Build a prompt that would help generate the SQL
    // In a real implementation, this would call an AI model
    const prompt = `
Generate a ${sqlDialect} SQL query based on this description: "${description}"

${schemaContext}

The query should:
1. Be written for ${sqlDialect} dialect
2. Use only the available tables and columns
3. Prioritize readability
4. Include appropriate comments
5. Be compatible with ${sqlDialect} syntax
`;

    // In a real implementation, this would be the result from an AI model call
    // For this demo, we'll generate a simple SQL query based on the description
    let generatedSQL: string;
    
    // Very simple pattern matching for demo purposes
    // In a real implementation, this would use a language model
    if (description.toLowerCase().includes('count')) {
      generatedSQL = `-- Count query generated from: "${description}"
SELECT COUNT(*) AS count 
FROM ${accessibleSchemas.length > 0 ? accessibleSchemas[0]!.table : 'table_name'};`;
    } else if (description.toLowerCase().includes('average') || description.toLowerCase().includes('avg')) {
      const table = accessibleSchemas.length > 0 ? accessibleSchemas[0]!.table : 'table_name';
      const numericColumn = accessibleSchemas.length > 0 
        ? accessibleSchemas[0]!.columns.find(col => ['int', 'numeric', 'decimal', 'float', 'real', 'double'].some(t => col.type.includes(t)))?.name || 'numeric_column'
        : 'numeric_column';
        
      generatedSQL = `-- Average query generated from: "${description}"
SELECT AVG(${numericColumn}) AS average
FROM ${table};`;
    } else if (description.toLowerCase().includes('join')) {
      generatedSQL = `-- Join query generated from: "${description}"
SELECT t1.*, t2.*
FROM ${accessibleSchemas.length > 0 ? accessibleSchemas[0]?.table : 'table1'} t1
JOIN ${accessibleSchemas.length > 1 ? accessibleSchemas[1]?.table : 'table2'} t2
  ON t1.id = t2.${accessibleSchemas.length > 0 ? accessibleSchemas[0]?.table : 'table1'}_id;`;
    } else {
      // Default to a simple SELECT
      const table = accessibleSchemas.length > 0 ? accessibleSchemas[0]!.table : 'table_name';
      generatedSQL = `-- Query generated from: "${description}"
SELECT * 
FROM ${table}
LIMIT 10;`;
    }
    
    // Return the generated SQL with explanations
    return formatPromptSuccessResponse(
      generatedSQL,
      // Add references to example queries that could help
      dialectExamples[sqlDialect]
    );
  } catch (error) {
    return formatPromptErrorResponse(
      `Failed to generate SQL: ${(error as Error).message}`,
      "SQL_GENERATION_ERROR"
    );
  }
}