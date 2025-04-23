import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import path from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

import { ConnectorManager } from "./connectors/manager.js";
import { ConnectorRegistry } from "./connectors/interface.js";
import { resolveDSN, resolveTransport, resolvePort, isDemoMode, redactDSN } from "./config/env.js";
import { getSqliteInMemorySetupSql } from "./config/demo-loader.js";
import { registerResources } from "./resources/index.js";
import { registerTools } from "./tools/index.js";
import { registerPrompts } from "./prompts/index.js";

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load package.json to get version
const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

// Server info
export const SERVER_NAME = "DBHub MCP Server";
export const SERVER_VERSION = packageJson.version;

/**
 * Generate ASCII art banner with version information
 */
export function generateBanner(version: string, isDemo: boolean = false): string {
  const demoText = isDemo ? " [DEMO MODE]" : "";

  return `
 _____  ____  _   _       _     
|  __ \\|  _ \\| | | |     | |    
| |  | | |_) | |_| |_   _| |__  
| |  | |  _ <|  _  | | | | '_ \\ 
| |__| | |_) | | | | |_| | |_) |
|_____/|____/|_| |_|\\__,_|_.__/ 
                                
v${version}${demoText} - Universal Database MCP Server
`;
}

/**
 * Initialize and start the DBHub server
 */
export async function main(): Promise<void> {
  try {
    // Resolve DSN from command line args, environment variables, or .env files
    const dsnData = resolveDSN();

    if (!dsnData) {
      const samples = ConnectorRegistry.getAllSampleDSNs();
      const sampleFormats = Object.entries(samples)
        .map(([id, dsn]) => `  - ${id}: ${dsn}`)
        .join("\n");

      console.error(`
ERROR: Database connection string (DSN) is required.
Please provide the DSN in one of these ways (in order of priority):

1. Use demo mode: --demo (uses in-memory SQLite with sample employee database)
2. Command line argument: --dsn="your-connection-string"
3. Environment variable: export DSN="your-connection-string"
4. .env file: DSN=your-connection-string

Example formats:
${sampleFormats}

See documentation for more details on configuring database connections.
`);
      process.exit(1);
    }

    // Create MCP server
    const server = new McpServer({
      name: SERVER_NAME,
      version: SERVER_VERSION,
    });

    // Register resources, tools, and prompts
    registerResources(server);
    registerTools(server);
    registerPrompts(server);

    // Create connector manager and connect to database
    const connectorManager = new ConnectorManager();
    console.error(`Connecting with DSN: ${redactDSN(dsnData.dsn)}`);
    console.error(`DSN source: ${dsnData.source}`);

    // If in demo mode, load the employee database
    if (dsnData.isDemo) {
      console.error("Running in demo mode with sample employee database");
      const initScript = getSqliteInMemorySetupSql();
      await connectorManager.connectWithDSN(dsnData.dsn, initScript);
    } else {
      await connectorManager.connectWithDSN(dsnData.dsn);
    }

    // Resolve transport type
    const transportData = resolveTransport();
    console.error(`Using transport: ${transportData.type}`);
    console.error(`Transport source: ${transportData.source}`);

    // Print ASCII art banner with version and slogan
    console.error(generateBanner(SERVER_VERSION, dsnData.isDemo));

    // Set up transport based on type
    if (transportData.type === "sse") {
      // Set up Express server for SSE transport
      const app = express();
      let transport: SSEServerTransport;

      app.get("/sse", async (req, res) => {
        transport = new SSEServerTransport("/message", res);
        console.error("Client connected", transport?.["_sessionId"]);
        await server.connect(transport);

        // Listen for connection close
        res.on("close", () => {
          console.error("Client Disconnected", transport?.["_sessionId"]);
        });
      });

      app.post("/message", async (req, res) => {
        console.error("Client Message", transport?.["_sessionId"]);
        await transport.handlePostMessage(req, res, req.body);
      });

      // Start the HTTP server (port is only relevant for SSE transport)
      const portData = resolvePort();
      const port = portData.port;
      console.error(`Port source: ${portData.source}`);
      app.listen(port, () => {
        console.error(`DBHub server listening at http://localhost:${port}`);
        console.error(`Connect to MCP server at http://localhost:${port}/sse`);
      });
    } else {
      // Set up STDIO transport
      const transport = new StdioServerTransport();
      console.error("Starting with STDIO transport");
      await server.connect(transport);

      // Listen for SIGINT to gracefully shut down
      process.on("SIGINT", async () => {
        console.error("Shutting down...");
        await transport.close();
        process.exit(0);
      });
    }
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  }
}
