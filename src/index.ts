import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { parseArgs } from 'node:util';

// Import connector modules
import './connectors/postgres/index.js';  // Register PostgreSQL connector
// import './connectors/sqlite/index.js';  // Uncomment to enable SQLite
import { ConnectorManager } from './connectors/manager.js';
import { ConnectorRegistry } from './interfaces/connector.js';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments first
const { values } = parseArgs({
  options: {
    dsn: { type: 'string' }
  }
});

// Function to load environment files
function loadEnvFiles(): string | null {
  // Determine if we're in development or production mode
  const isDevelopment = process.env.NODE_ENV === 'development' || process.argv[1]?.includes('tsx');

  // Select environment file names based on environment
  const envFileNames = isDevelopment 
    ? ['.env.local', '.env'] // In development, try .env.local first, then .env
    : ['.env']; // In production, only look for .env

  // Build paths to check for environment files
  const envPaths = [];
  for (const fileName of envFileNames) {
    envPaths.push(
      fileName, // Current working directory
      path.join(__dirname, fileName), // Same directory as the script
      path.join(__dirname, '..', fileName), // Parent directory (for compiled code)
      path.join(process.cwd(), fileName) // Explicit current working directory
    );
  }

  // Try to load the first env file found from the prioritized locations
  for (const envPath of envPaths) {
    console.error(`Checking for env file: ${envPath}`);
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      // Return the name of the file that was loaded
      return path.basename(envPath);
    }
  }
  
  return null;
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
    // Get DSN with strict priority: Command line > Environment variable > .env files
    let dsn: string | undefined;
    
    // 1. Check command line arguments first (highest priority)
    if (values.dsn) {
      dsn = values.dsn;
      console.error('Using DSN from command line argument');
    }
    // 2. Check environment variables if no command line argument (but before loading .env)
    else if (process.env.DSN) {
      dsn = process.env.DSN;
      console.error('Using DSN from environment variable');
    }
    // 3. If no command line or environment variable, try loading from .env files
    else {
      const loadedEnvFile = loadEnvFiles();
      if (loadedEnvFile && process.env.DSN) {
        dsn = process.env.DSN;
        console.error(`Using DSN from ${loadedEnvFile} file`);
      }
    }
    
    if (!dsn) {
      const samples = ConnectorRegistry.getAllSampleDSNs();
      const sampleFormats = Object.entries(samples)
        .map(([id, dsn]) => `  - ${id}: ${dsn}`)
        .join('\n');
      
      console.error(`
ERROR: Database connection string (DSN) is required.
Please provide the DSN in one of these ways (in order of priority):

1. Command line argument: --dsn="your-connection-string"
2. Environment variable: export DSN="your-connection-string"
3. .env file: DSN=your-connection-string

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