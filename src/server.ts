import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from 'express';

import { ConnectorManager } from './connectors/manager.js';
import { ConnectorRegistry } from './interfaces/connector.js';
import { resolveDSN } from './config/env.js';
import { SERVER_NAME, SERVER_VERSION } from './utils/package-info.js';
import { generateBanner } from './utils/ascii-banner.js';
import { registerResources } from './routes/index.js';
import { registerTools } from './tools/index.js';

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
    
    // Create MCP server
    const server = new McpServer({
      name: SERVER_NAME,
      version: SERVER_VERSION
    });
    
    // Register resources and tools
    registerResources(server);
    registerTools(server);
    
    // Create connector manager and connect to database
    const connectorManager = new ConnectorManager();
    console.error(`Connecting with DSN: ${dsnData.dsn}`);
    console.error(`DSN source: ${dsnData.source}`);
    await connectorManager.connectWithDSN(dsnData.dsn);
    
    // Set up Express server for SSE transport
    const app = express();
    let transport: SSEServerTransport;

    app.get("/sse", async (req, res) => {
      transport = new SSEServerTransport("/message", res);
      console.error("Client connected", transport?.['_sessionId']);
      await server.connect(transport);
      
      // Listen for connection close
      res.on('close', () => {
        console.error("Client Disconnected", transport?.['_sessionId']);
      });
    });
    
    app.post("/message", async (req, res) => {
      console.error("Client Message", transport?.['_sessionId']);
      await transport.handlePostMessage(req, res, req.body);
    });
    
    // Print ASCII art banner with version and slogan
    console.error(generateBanner(SERVER_VERSION));
    
    // Start the HTTP server
    const port = process.env.PORT || 8080;
    app.listen(port, () => {
      console.error(`DBHub server listening at http://localhost:${port}`);
      console.error(`Connect to MCP server at http://localhost:${port}/sse`);
    });
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  }
}