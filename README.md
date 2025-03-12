<p align="center">
<a href="https://dbhub.ai/" target="_blank">
<picture>
  <img src="https://raw.githubusercontent.com/bytebase/dbhub/main/assets/logo-full.svg" width="50%">
</picture>
</a>
</p>

DBHub is a universal database gateway implementing the Model Context Protocol (MCP) server interface. This gateway allows MCP-compatible clients to connect to and explore different databases.

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

## Installation

### Docker

```bash
docker run --rm --init \
   --name dbhub \
   --publish 8080:8080 \
   bytebase/dbhub \
   --transport sse \
   --port 8080 \
   --dsn "postgres://user:password@localhost:5432/dbname?sslmode=disable"
```

### NPM

```bash
# Install latest stable version globally
npm install -g @bytebase/dbhub

# Or install development version
npm install -g @bytebase/dbhub@dev

# Run from anywhere
dbhub --dsn="postgres://user:password@localhost:5432/dbname"

# Run via npx
npx @bytebase/dbhub --dsn="postgres://user:password@localhost:5432/dbname"
```

## Usage

### Configure your database connection

Database Source Name (DSN) is required to connect to your database. You can provide this in several ways:

- **Command line argument** (highest priority):

  ```bash
  pnpm dev --dsn "postgres://user:password@localhost:5432/dbname?sslmode=disable"
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

### Transport

- **stdio** (default) - for direct integration with tools like Claude Desktop:

  ```bash
  npx @bytebase/dbhub --transport stdio --dsn "postgres://user:password@localhost:5432/dbname?sslmode=disable"
  ```

- **sse** - for browser and network clients:
  ```bash
  npx @bytebase/dbhub --transport sse --port 5678 --dsn "postgres://user:password@localhost:5432/dbname?sslmode=disable"
  ```

### Command line options

| Option    | Description                                                     | Default                             |
| :-------- | :-------------------------------------------------------------- | :---------------------------------- |
| dsn       | Database connection string                                      | Required if not set via environment |
| transport | Transport mode: `stdio` or `sse`                                | `stdio`                             |
| port      | HTTP server port (only applicable when using `--transport=sse`) | `8080`                              |

### Claude Desktop

![claude-desktop](https://raw.githubusercontent.com/bytebase/dbhub/main/assets/claude-desktop.webp)

Add to `claude_desktop_config.json`

```json
{
  "mcpServers": {
    "dbhub": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "bytebase/dbhub",
        "--transport",
        "stdio",
        "--dsn",
        "postgres://user:password@host.docker.internal:5432/dbname?sslmode=disable"
      ]
    }
  }
}
```

## Development

1. Install dependencies:

   ```bash
   pnpm install
   ```

1. Run in development mode:

   ```bash
   pnpm dev
   ```

1. Build for production:
   ```bash
   pnpm build
   pnpm start --transport stdio --dsn "postgres://user:password@localhost:5432/dbname?sslmode=disable"
   ```

### Debug with [MCP Inspector](https://github.com/modelcontextprotocol/inspector)

#### stdio

```bash
TRANSPORT=stdio DSN="postgres://user:password@localhost:5432/dbname?sslmode=disable" npx @modelcontextprotocol/inspector node /path/to/dbhub/dist/index.js
```

#### SSE

```bash
# Start DBHub with SSE transport
pnpm dev --transport=sse --port=8080

# Start the MCP Inspector in another terminal
npx @modelcontextprotocol/inspector
```

Connect to the DBHub server `/sse` endpoint

![mcp-inspector](https://raw.githubusercontent.com/bytebase/dbhub/main/assets/mcp-inspector.webp)
