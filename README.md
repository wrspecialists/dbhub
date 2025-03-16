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
 |                  |    |              +--->+     DuckDB       |
 |                  |    |              |    |      (soon)      |
 |                  |    |              +--->+  Other Databases |
 |                  |    |              |    |     (coming)     |
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
# PostgreSQL example
docker run --rm --init \
   --name dbhub \
   --publish 8080:8080 \
   bytebase/dbhub \
   --transport sse \
   --port 8080 \
   --dsn "postgres://user:password@localhost:5432/dbname?sslmode=disable"

# SQLite in-memory example
docker run --rm --init \
   --name dbhub \
   --publish 8080:8080 \
   bytebase/dbhub \
   --transport sse \
   --port 8080 \
   --dsn "sqlite::memory:"

# MySQL example
docker run --rm --init \
   --name dbhub \
   --publish 8080:8080 \
   bytebase/dbhub \
   --transport sse \
   --port 8080 \
   --dsn "mysql://user:password@localhost:3306/dbname"
```

### NPM

```bash
# PostgreSQL example
npx @bytebase/dbhub --transport sse --port 8080 --dsn "postgres://user:password@localhost:5432/dbname"

# SQLite example
npx @bytebase/dbhub --transport sse --port 8080 --dsn "sqlite:///path/to/database.db"

# MySQL example
npx @bytebase/dbhub --transport sse --port 8080 --dsn "mysql://user:password@localhost:3306/dbname"
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

### Supported DSN formats

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
| dsn       | Database connection string                                      | Required if not set via environment |
| transport | Transport mode: `stdio` or `sse`                                | `stdio`                             |
| port      | HTTP server port (only applicable when using `--transport=sse`) | `8080`                              |

### Claude Desktop

![claude-desktop](https://raw.githubusercontent.com/bytebase/dbhub/main/resources/images/claude-desktop.webp)

- Claude Desktop only supports `stdio` transport https://github.com/orgs/modelcontextprotocol/discussions/16

### Cursor

![cursor](https://raw.githubusercontent.com/bytebase/dbhub/main/resources/images/cursor.webp)

- Cursor supports both `stdio` and `sse`.
- Follow [Cursor MCP guide](https://docs.cursor.com/context/model-context-protocol) and make sure to use [Agent](https://docs.cursor.com/chat/agent) mode.

#### Docker

```json
// claude_desktop_config.json - PostgreSQL example
{
  "mcpServers": {
    "dbhub-postgres": {
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
    }
  }
}
```

```json
// claude_desktop_config.json - SQLite example (in-memory)
{
  "mcpServers": {
    "dbhub-sqlite": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "bytebase/dbhub",
        "--transport",
        "stdio",
        "--dsn",
        "sqlite::memory:"
      ]
    }
  }
}
```

#### NPX

```json
// claude_desktop_config.json - PostgreSQL example
{
  "mcpServers": {
    "dbhub-postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@bytebase/dbhub",
        "--transport",
        "stdio",
        "--dsn",
        "postgres://user:password@localhost:5432/dbname?sslmode=disable"
      ]
    }
  }
}
```

```json
// claude_desktop_config.json - SQLite example
{
  "mcpServers": {
    "dbhub-sqlite": {
      "command": "npx",
      "args": [
        "-y",
        "@bytebase/dbhub",
        "--transport",
        "stdio",
        "--dsn",
        "sqlite:///path/to/database.db"
      ]
    }
  }
}
```

```json
// claude_desktop_config.json - MySQL example
{
  "mcpServers": {
    "dbhub-mysql": {
      "command": "npx",
      "args": [
        "-y",
        "@bytebase/dbhub",
        "--transport",
        "stdio",
        "--dsn",
        "mysql://user:password@localhost:3306/dbname"
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
# PostgreSQL example
TRANSPORT=stdio DSN="postgres://user:password@localhost:5432/dbname?sslmode=disable" npx @modelcontextprotocol/inspector node /path/to/dbhub/dist/index.js

# SQLite example
TRANSPORT=stdio DSN="sqlite:///path/to/database.db" npx @modelcontextprotocol/inspector node /path/to/dbhub/dist/index.js

# SQLite in-memory example  
TRANSPORT=stdio DSN="sqlite::memory:" npx @modelcontextprotocol/inspector node /path/to/dbhub/dist/index.js

# MySQL example
TRANSPORT=stdio DSN="mysql://user:password@localhost:3306/dbname" npx @modelcontextprotocol/inspector node /path/to/dbhub/dist/index.js
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
