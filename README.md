<p align="center">
<a href="https://dbhub.ai/" target="_blank">
<picture>
  <img src="https://raw.githubusercontent.com/bytebase/dbhub/main/resources/images/logo-full.svg" width="50%">
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
 |      Cursor      +--->+    DBHub     +--->+    SQL Server    |
 |                  |    |              |    |                  |
 |     Other MCP    +--->+              +--->+     SQLite       |
 |      Clients     |    |              |    |                  |
 |                  |    |              +--->+     MySQL        |
 |                  |    |              |    |                  |
 |                  |    |              +--->+  Other Databases |
 |                  |    |              |    |                  |
 +------------------+    +--------------+    +------------------+
      MCP Clients           MCP Server             Databases
```

## Supported Matrix

### Database Resources

| Resource               | URI Format | PostgreSQL | MySQL | SQL Server | SQLite |
|------------------------|:----------:|:----------:|:-----:|:----------:|:------:|
| Tables                 | `db://tables` |     ✅     |   ✅  |     ✅     |   ✅   |
| Schema                 | `db://schema/{tableName}` |     ✅     |   ✅  |     ✅     |   ✅   |

### Database Tools

| Tool                   | Command Name       | PostgreSQL | MySQL | SQL Server | SQLite |
|------------------------|:------------------:|:----------:|:-----:|:----------:|:------:|
| Execute Query          | `run_query`        |     ✅     |   ✅  |     ✅     |   ✅   |
| List Connectors        | `list_connectors`  |     ✅     |   ✅  |     ✅     |   ✅   |

### Prompt Capabilities

| Prompt                 | Command Name     | PostgreSQL | MySQL | SQL Server | SQLite |
|------------------------|:----------------:|:----------:|:-----:|:----------:|:------:|
| Generate SQL           | `generate_sql`   |     ✅     |   ✅  |     ✅     |   ✅   |
| Explain DB Elements    | `explain_db`     |     ✅     |   ✅  |     ✅     |   ✅   |

## Installation

### Docker

```bash
# PostgreSQL example
docker run --rm --init \
   --name dbhub \
   --publish 8080:8080 \
   bytebase/dbhub \
   --transport sse \
   --port 8080 \
   --dsn "postgres://user:password@localhost:5432/dbname?sslmode=disable"
```

```bash
# Demo mode with sample employee database
docker run --rm --init \
   --name dbhub \
   --publish 8080:8080 \
   bytebase/dbhub \
   --transport sse \
   --port 8080 \
   --demo
```

### NPM

```bash
# PostgreSQL example
npx @bytebase/dbhub --transport sse --port 8080 --dsn "postgres://user:password@localhost:5432/dbname"
```

```bash
# Demo mode with sample employee database
npx @bytebase/dbhub --transport sse --port 8080 --demo
```

### Claude Desktop

![claude-desktop](https://raw.githubusercontent.com/bytebase/dbhub/main/resources/images/claude-desktop.webp)

- Claude Desktop only supports `stdio` transport https://github.com/orgs/modelcontextprotocol/discussions/16

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "dbhub-postgres-docker": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "bytebase/dbhub",
        "--transport",
        "stdio",
        "--dsn",
        // Use host.docker.internal as the host if connecting to the local db
        "postgres://user:password@host.docker.internal:5432/dbname?sslmode=disable"
      ]
    },
    "dbhub-postgres-npx": {
      "command": "npx",
      "args": [
        "-y",
        "@bytebase/dbhub",
        "--transport",
        "stdio",
        "--dsn",
        "postgres://user:password@localhost:5432/dbname?sslmode=disable"
      ]
    },
    "dbhub-demo": {
      "command": "npx",
      "args": [
        "-y",
        "@bytebase/dbhub",
        "--transport",
        "stdio",
        "--demo"
      ]
    }
  }
}
```

### Cursor

![cursor](https://raw.githubusercontent.com/bytebase/dbhub/main/resources/images/cursor.webp)

- Cursor supports both `stdio` and `sse`.
- Follow [Cursor MCP guide](https://docs.cursor.com/context/model-context-protocol) and make sure to use [Agent](https://docs.cursor.com/chat/agent) mode.

## Usage

### Configure your database connection

You can use DBHub in demo mode with a sample employee database for testing:

```bash
pnpm dev --demo
```

For real databases, a Database Source Name (DSN) is required. You can provide this in several ways:

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

DBHub supports the following database connection string formats:

| Database   | DSN Format                                                | Example                                                 |
|------------|-----------------------------------------------------------|--------------------------------------------------------|
| PostgreSQL | `postgres://[user]:[password]@[host]:[port]/[database]`   | `postgres://user:password@localhost:5432/dbname?sslmode=disable` |
| SQLite     | `sqlite:///[path/to/file]` or `sqlite::memory:`           | `sqlite:///path/to/database.db` or `sqlite::memory:`  |
| SQL Server | `sqlserver://[user]:[password]@[host]:[port]/[database]`  | `sqlserver://user:password@localhost:1433/dbname`      |
| MySQL      | `mysql://[user]:[password]@[host]:[port]/[database]`      | `mysql://user:password@localhost:3306/dbname`          |

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
| demo      | Run in demo mode with sample employee database                  | `false`                             |
| dsn       | Database connection string                                      | Required if not in demo mode        |
| transport | Transport mode: `stdio` or `sse`                                | `stdio`                             |
| port      | HTTP server port (only applicable when using `--transport=sse`) | `8080`                              |


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
# PostgreSQL example
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

![mcp-inspector](https://raw.githubusercontent.com/bytebase/dbhub/main/resources/images/mcp-inspector.webp)
