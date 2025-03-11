# DBHub - Universal Database MCP Server

DBHub is a universal database gateway implementing the Model Context Protocol (MCP) server interface. This gateway allows MCP-compatible client to connect to and explore different databases.

```bash
 +------------------+    +--------------+    +------------------+
 |                  |    |              |    |                  |
 |                  |    |              |    |                  |
 |  Claude Desktop  +--->+              +--->+    PostgreSQL    |
 |                  |    |              |    |                  |
 |      Cursor      +--->+    DBHub     +--->+      MySQL       |
 |                  |    |              |    |                  |
 |     Other MCP    +--->+              +--->+     SQLite       |
 |      Clients     |    |              |    |                  |
 |                  |    |              +--->+     DuckDB       |
 |                  |    |              |    |                  |
 |                  |    |              +--->+  Other Databases |
 |                  |    |              |    |                  |
 +------------------+    +--------------+    +------------------+
      MCP Clients           MCP Server             Databases
 ```

## Features

- Browse available tables in the database
- View schema information for tables
- Run read-only SQL queries against the database
- Safety checks to prevent dangerous queries

## Usage

### Claude Desktop

![claude-desktop](https://raw.githubusercontent.com/bytebase/dbhub/main/assets/claude-desktop.webp)

## Development

1. Install dependencies:

   ```bash
   pnpm install
   ```

1. Configure your database connection:

   DBHub requires a Database Source Name (DSN) to connect to your database. You can provide this in several ways:

   - **Command line argument** (highest priority):

     ```bash
     pnpm dev --dsn="postgres://user:password@localhost:5432/dbname?sslmode=disable"
     ```

   - **Environment variable** (second priority):

     ```bash
     export DSN="postgres://user:password@localhost:5432/dbname?sslmode=disable"
     pnpm dev
     ```

   - **Environment file** (third priority):
     - For development: Create `.env.local` with your DSN
     - For production: Create `.env` with your DSN
     ```
     DSN=postgres://user:password@localhost:5432/dbname?sslmode=disable
     ```

1. Choose a transport mode:

   DBHub supports two transport modes:
   
   - **stdio** (default) - for direct integration with tools like Claude Desktop
     ```bash
     pnpm dev --transport=stdio
     ```
   
   - **sse** - for browser and network clients
     ```bash
     pnpm dev --transport=sse
     ```

1. Run in development mode:

   ```bash
   pnpm dev
   ```

1. Build for production:
   ```bash
   pnpm build
   pnpm start --transport=stdio --dsn="postgres://user:password@localhost:5432/dbname?sslmode=disable"
   ```

### Debug with [MCP Inspector](https://github.com/modelcontextprotocol/inspector)

#### stdio

```bash
TRANSPORT=stdio DSN="postgres://user:password@localhost:5432/dbname?sslmode=disable" npx @modelcontextprotocol/inspector node /path/to/dbhub/dist/index.js
```

#### SSE

```bash
# Start DBHub with SSE transport
pnpm dev --transport=sse 

# Start the MCP Inspector in another terminal
npx @modelcontextprotocol/inspector
```

Connect to the DBHub server `/sse` endpoint

![mcp-inspector](https://raw.githubusercontent.com/bytebase/dbhub/main/assets/mcp-inspector.webp)
