import mysql from 'mysql2/promise';
import { Connector, ConnectorRegistry, DSNParser, QueryResult, TableColumn } from '../interface.js';

/**
 * MySQL DSN Parser
 * Handles DSN strings like: mysql://user:password@localhost:3306/dbname
 */
class MySQLDSNParser implements DSNParser {
  parse(dsn: string): mysql.ConnectionOptions {
    // Basic validation
    if (!this.isValidDSN(dsn)) {
      throw new Error(`Invalid MySQL DSN: ${dsn}`);
    }

    try {
      const url = new URL(dsn);
      
      const config: mysql.ConnectionOptions = {
        host: url.hostname,
        port: url.port ? parseInt(url.port) : 3306,
        database: url.pathname.substring(1), // Remove leading '/'
        user: url.username,
        password: url.password,
      };
      
      // Handle query parameters
      url.searchParams.forEach((value, key) => {
        if (key === 'ssl') {
          config.ssl = value === 'true' ? {} : undefined;
        }
        // Add other parameters as needed
      });
      
      return config;
    } catch (error) {
      throw new Error(`Failed to parse MySQL DSN: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getSampleDSN(): string {
    return 'mysql://root:password@localhost:3306/mysql';
  }

  isValidDSN(dsn: string): boolean {
    try {
      const url = new URL(dsn);
      return url.protocol === 'mysql:';
    } catch (error) {
      return false;
    }
  }
}

/**
 * MySQL Connector Implementation
 */
export class MySQLConnector implements Connector {
  id = 'mysql';
  name = 'MySQL';
  dsnParser = new MySQLDSNParser();
  
  private pool: mysql.Pool | null = null;

  async connect(dsn: string): Promise<void> {
    try {
      const config = this.dsnParser.parse(dsn);
      this.pool = mysql.createPool(config);
      
      // Test the connection
      const [rows] = await this.pool.query('SELECT 1');
      console.error("Successfully connected to MySQL database");
    } catch (err) {
      console.error("Failed to connect to MySQL database:", err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async getTables(): Promise<string[]> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }
    
    try {
      // Get all tables from the current database
      const [rows] = await this.pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE()
        ORDER BY table_name
      `) as [any[], any];
      
      return rows.map(row => row.table_name);
    } catch (error) {
      console.error("Error getting tables:", error);
      throw error;
    }
  }

  async tableExists(tableName: string): Promise<boolean> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }
    
    try {
      const [rows] = await this.pool.query(`
        SELECT COUNT(*) as count
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() 
        AND table_name = ?
      `, [tableName]) as [any[], any];
      
      return rows[0].count > 0;
    } catch (error) {
      console.error("Error checking if table exists:", error);
      throw error;
    }
  }

  async getTableSchema(tableName: string): Promise<TableColumn[]> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }
    
    try {
      // Get table columns
      const [rows] = await this.pool.query(`
        SELECT 
          column_name, 
          data_type, 
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
        AND table_name = ?
        ORDER BY ordinal_position
      `, [tableName]) as [any[], any];
      
      return rows;
    } catch (error) {
      console.error("Error getting table schema:", error);
      throw error;
    }
  }

  async executeQuery(query: string): Promise<QueryResult> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }
    
    const safetyCheck = this.validateQuery(query);
    if (!safetyCheck.isValid) {
      throw new Error(safetyCheck.message || "Query validation failed");
    }

    try {
      const [rows, fields] = await this.pool.query(query) as [any[], any];
      return { rows, fields };
    } catch (error) {
      console.error("Error executing query:", error);
      throw error;
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

// Create and register the connector
const mysqlConnector = new MySQLConnector();
ConnectorRegistry.register(mysqlConnector);