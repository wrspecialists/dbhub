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

2. Configure environment:

   - Copy `.env.example` to `.env`
   - Edit with your PostgreSQL connection details

3. Run in development mode:

   ```bash
   pnpm dev
   ```

4. Build for production:
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
