import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Import connector modules
import './connectors/postgres/index.js';  // Register PostgreSQL connector
import { ConnectorManager } from './connectors/manager.js';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load environment variables from multiple possible locations
const envPaths = [
  '.env',                                      // Current working directory
  path.join(__dirname, '.env'),                // Same directory as the script
  path.join(__dirname, '..', '.env'),          // Parent directory (for compiled code)
  path.join(process.cwd(), '.env')             // Explicit current working directory
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.error(`Loading environment from: ${envPath}`);
    dotenv.config({ path: envPath });
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.error("Warning: No .env file found. Using default or environment variables.");
}

// Determine which database connector to use from environment variables
const connectorType = process.env.DB_CONNECTOR_TYPE || 'postgres';
const connectorManager = new ConnectorManager(connectorType);

// Create MCP server
const server = new McpServer({
  name: "DBHub MCP Server",
  version: "0.0.1"
});

// Resource for listing all tables
server.resource(
  "tables",
  "db://tables",
  async (uri) => {
    const connector = connectorManager.getConnector();
    const tableNames = await connector.getTables();
    
    return {
      contents: [{
        uri: uri.href,
        text: `Available tables:\n\n${tableNames.join('\n')}`
      }]
    };
  }
);

// Resource for getting table schema
server.resource(
  "schema",
  new ResourceTemplate("db://schema/{tableName}", { list: undefined }),
  async (uri, { tableName }) => {
    const connector = connectorManager.getConnector();
    
    // Check if table exists
    const tableExists = await connector.tableExists(tableName as string);
    if (!tableExists) {
      throw new Error(`Table '${tableName}' does not exist`);
    }
    
    // Get table columns
    const columns = await connector.getTableSchema(tableName as string);
    
    // Format schema information
    const schemaInfo = columns.map(col => 
      `${col.column_name} ${col.data_type} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}${col.column_default ? ` DEFAULT ${col.column_default}` : ''}`
    ).join('\n');
    
    return {
      contents: [{
        uri: uri.href,
        text: `Schema for table '${tableName}':\n\n${schemaInfo}`
      }]
    };
  }
);

// Tool to run a SQL query (read-only for safety)
server.tool(
  "run-query",
  { 
    query: z.string().describe("SQL query to execute (SELECT only)")
  },
  async ({ query }) => {
    const connector = connectorManager.getConnector();
    
    try {
      // The connector will validate the query internally
      const result = await connector.executeQuery(query);
      
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify(result.rows, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `Error executing query: ${(error as Error).message}`
        }],
        isError: true
      };
    }
  }
);

// Tool to list available database connectors
server.tool(
  "list-connectors",
  {},
  async () => {
    const connectors = ConnectorManager.getAvailableConnectors();
    
    return {
      content: [{ 
        type: "text", 
        text: `Available database connectors:\n\n${connectors.join('\n')}`
      }]
    };
  }
);

// Start the server
async function main() {
  try {
    // Initialize the database connector
    await connectorManager.initialize();
    
    // Start the server with stdio transport
    const transport = new StdioServerTransport();
    console.error(`Starting DBHub MCP Server with ${connectorType} connector...`);
    await server.connect(transport);
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  }
}

// Run the server
main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});