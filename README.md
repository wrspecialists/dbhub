# DBHub - Universal MCP Server

DBHub is a universal server implementing the Model Context Protocol (MCP) interface. This server allows LLMs to connect to and explore different databases safely.

## Features

- Browse available tables in the database
- View schema information for tables
- Run read-only SQL queries against the database
- Safety checks to prevent dangerous queries

## Setup

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

1. Run in development mode:

   ```bash
   pnpm dev
   ```

1. Build for production:
   ```bash
   pnpm build
   pnpm start
   ```

## Usage

This server can be used with any MCP-compatible client, including:

- LLM platforms that support MCP
- The [MCP Inspector](https://github.com/modelcontextprotocol/inspector)

## License

MIT License
