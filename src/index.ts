import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import pg from "pg";
const { Pool } = pg;
import dotenv from "dotenv";
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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

// Create database connection pool with fallbacks
const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
  database: process.env.PG_DATABASE || 'postgres',
});

// Create MCP server
const server = new McpServer({
  name: "DBHub MCP Server",
  version: "0.0.1"
});

// Resource for listing all tables
server.resource(
  "tables",
  "pg://tables",
  async (uri) => {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      
      const tableNames = result.rows.map(row => row.table_name);
      return {
        contents: [{
          uri: uri.href,
          text: `Available tables:\n\n${tableNames.join('\n')}`
        }]
      };
    } finally {
      client.release();
    }
  }
);

// Resource for getting table schema
server.resource(
  "schema",
  new ResourceTemplate("pg://schema/{tableName}", { list: undefined }),
  async (uri, { tableName }) => {
    const client = await pool.connect();
    try {
      // Check if table exists
      const tableExistsResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [tableName]);
      
      if (!tableExistsResult.rows[0].exists) {
        throw new Error(`Table '${tableName}' does not exist`);
      }
      
      // Get table columns
      const columnsResult = await client.query(`
        SELECT 
          column_name, 
          data_type, 
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      // Format schema information
      const schemaInfo = columnsResult.rows.map(col => 
        `${col.column_name} ${col.data_type} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}${col.column_default ? ` DEFAULT ${col.column_default}` : ''}`
      ).join('\n');
      
      return {
        contents: [{
          uri: uri.href,
          text: `Schema for table '${tableName}':\n\n${schemaInfo}`
        }]
      };
    } finally {
      client.release();
    }
  }
);

// Tool to run a SQL query (read-only for safety)
server.tool(
  "run-query",
  { 
    query: z.string().describe("SQL query to execute (SELECT only)")
  },
  async ({ query }) => {
    // Basic check to prevent non-SELECT queries
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery.startsWith('select')) {
      return {
        content: [{ 
          type: "text", 
          text: "Error: Only SELECT queries are allowed for security reasons."
        }],
        isError: true
      };
    }
    
    const client = await pool.connect();
    try {
      const result = await client.query(query);
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
    } finally {
      client.release();
    }
  }
);

// Start the server
async function main() {
  // Check database connection
  try {
    const client = await pool.connect();
    console.error("Successfully connected to PostgreSQL database");
    client.release();
  } catch (err) {
    console.error("Failed to connect to PostgreSQL database:", err);
    process.exit(1);
  }

  // Start the server with stdio transport
  const transport = new StdioServerTransport();
  console.error("Starting PostgreSQL MCP Server...");
  await server.connect(transport);
}

// Run the server
main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
