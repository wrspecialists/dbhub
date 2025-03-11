import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Import connector modules
import './connectors/postgres/index.js';  // Register PostgreSQL connector
// import './connectors/sqlite/index.js';  // Uncomment to enable SQLite
import { ConnectorManager } from './connectors/manager.js';
import { ConnectorRegistry } from './interfaces/connector.js';

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

// Get database connection info
const connectorManager = new ConnectorManager();

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
    const samples = ConnectorRegistry.getAllSampleDSNs();
    
    const formattedSamples = Object.entries(samples)
      .map(([id, dsn]) => `${id}: ${dsn}`)
      .join('\n');
    
    return {
      content: [{ 
        type: "text", 
        text: `Available database connectors:\n\n${formattedSamples}`
      }]
    };
  }
);

// Start the server
async function main() {
  try {
    // Get the DSN from environment variables
    const dsn = process.env.DSN;
    
    if (!dsn) {
      const samples = ConnectorRegistry.getAllSampleDSNs();
      const sampleFormats = Object.entries(samples)
        .map(([id, dsn]) => `  - ${id}: ${dsn}`)
        .join('\n');
      
      console.error(`
ERROR: Database connection string (DSN) is required.
Please set the DSN environment variable in your .env file or environment.

Example formats:
${sampleFormats}

See documentation for more details on configuring database connections.
`);
      process.exit(1);
    }
    
    // Connect using DSN string
    console.error(`Connecting with DSN: ${dsn}`);
    await connectorManager.connectWithDSN(dsn);
    
    // Start the server with stdio transport
    const transport = new StdioServerTransport();
    console.error(`Starting DBHub MCP Server...`);
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