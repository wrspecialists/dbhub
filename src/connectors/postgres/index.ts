import pg from 'pg';
const { Pool } = pg;
import { Connector, ConnectorRegistry, QueryResult, TableColumn } from '../../interfaces/connector.js';

/**
 * PostgreSQL Connector Implementation
 */
export class PostgresConnector implements Connector {
  id = 'postgres';
  name = 'PostgreSQL';
  
  private pool: pg.Pool;
  private connected = false;

  constructor(
    private config: {
      host: string;
      port: number;
      user: string;
      password: string;
      database: string;
    }
  ) {
    this.pool = new Pool(config);
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      console.error("Successfully connected to PostgreSQL database");
      client.release();
      this.connected = true;
    } catch (err) {
      console.error("Failed to connect to PostgreSQL database:", err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
    this.connected = false;
  }

  async getTables(): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      
      return result.rows.map(row => row.table_name);
    } finally {
      client.release();
    }
  }

  async tableExists(tableName: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [tableName]);
      
      return result.rows[0].exists;
    } finally {
      client.release();
    }
  }

  async getTableSchema(tableName: string): Promise<TableColumn[]> {
    const client = await this.pool.connect();
    try {
      // Get table columns
      const result = await client.query(`
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
      
      return result.rows;
    } finally {
      client.release();
    }
  }

  async executeQuery(query: string): Promise<QueryResult> {
    const safetyCheck = this.validateQuery(query);
    if (!safetyCheck.isValid) {
      throw new Error(safetyCheck.message || "Query validation failed");
    }

    const client = await this.pool.connect();
    try {
      return await client.query(query);
    } finally {
      client.release();
    }
  }

  validateQuery(query: string): { isValid: boolean; message?: string } {
    // Basic check to prevent non-SELECT queries
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery.startsWith('select')) {
      return {
        isValid: false,
        message: "Only SELECT queries are allowed for security reasons."
      };
    }
    return { isValid: true };
  }
}

/**
 * Factory function to create a PostgreSQL connector from environment variables
 */
export function createPostgresConnector(): Connector {
  return new PostgresConnector({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    database: process.env.PG_DATABASE || 'postgres',
  });
}

// Register the PostgreSQL connector with the registry
ConnectorRegistry.register('postgres', createPostgresConnector);