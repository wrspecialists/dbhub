/**
 * SQLite Connector Implementation
 * 
 * Implements SQLite database connectivity for DBHub using better-sqlite3
 * To use this connector:
 * 1. Set DSN=sqlite:///path/to/database.db in your .env file
 * 2. Or set DB_CONNECTOR_TYPE=sqlite for default in-memory database
 */

import { Connector, ConnectorRegistry, DSNParser, QueryResult, TableColumn } from '../interface.js';
import Database from 'better-sqlite3';

/**
 * SQLite DSN Parser
 * Handles DSN strings like: 
 * - sqlite:///path/to/database.db (absolute path)
 * - sqlite://./relative/path/to/database.db (relative path)
 * - sqlite::memory: (in-memory database)
 */
class SQLiteDSNParser implements DSNParser {
  parse(dsn: string): { dbPath: string } {
    // Basic validation
    if (!this.isValidDSN(dsn)) {
      throw new Error(`Invalid SQLite DSN: ${dsn}`);
    }

    try {
      const url = new URL(dsn);
      let dbPath: string;
      
      // Handle in-memory database
      if (url.hostname === '' && url.pathname === ':memory:') {
        dbPath = ':memory:';
      } 
      // Handle file paths
      else {
        // Get the path part, handling both relative and absolute paths
        if (url.pathname.startsWith('//')) {
          // Absolute path: sqlite:///path/to/db.sqlite
          dbPath = url.pathname.substring(2); // Remove leading //
        } else {
          // Relative path: sqlite://./path/to/db.sqlite
          dbPath = url.pathname;
        }
      }
      
      return { dbPath };
    } catch (error) {
      throw new Error(`Failed to parse SQLite DSN: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getSampleDSN(): string {
    return 'sqlite:///path/to/database.db';
  }

  isValidDSN(dsn: string): boolean {
    try {
      const url = new URL(dsn);
      return url.protocol === 'sqlite:';
    } catch (error) {
      return false;
    }
  }
}

interface SQLiteTableInfo {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface SQLiteTableNameRow {
  name: string;
}

export class SQLiteConnector implements Connector {
  id = 'sqlite';
  name = 'SQLite';
  dsnParser = new SQLiteDSNParser();
  
  private db: Database.Database | null = null;
  private dbPath: string = ':memory:'; // Default to in-memory database

  async connect(dsn: string, initScript?: string): Promise<void> {
    const config = this.dsnParser.parse(dsn);
    this.dbPath = config.dbPath;
    
    try {
      this.db = new Database(this.dbPath);
      console.error("Successfully connected to SQLite database");
      
      // If an initialization script is provided, run it
      if (initScript) {
        this.db.exec(initScript);
        console.error("Successfully initialized database with script");
      }
    } catch (error) {
      console.error("Failed to connect to SQLite database:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      try {
        this.db.close();
        this.db = null;
      } catch (error) {
        throw error;
      }
    }
    return Promise.resolve();
  }

  async getSchemas(): Promise<string[]> {
    if (!this.db) {
      throw new Error("Not connected to SQLite database");
    }
    
    // SQLite doesn't have the concept of schemas like PostgreSQL or MySQL
    // Return the database name or 'main' for in-memory databases
    return [this.dbPath === ':memory:' ? 'main' : this.dbPath];
  }

  async getTables(schema?: string): Promise<string[]> {
    if (!this.db) {
      throw new Error("Not connected to SQLite database");
    }
    
    // In SQLite, schema parameter is ignored since SQLite doesn't support multiple schemas
    try {
      const rows = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all() as SQLiteTableNameRow[];
      
      return rows.map(row => row.name);
    } catch (error) {
      throw error;
    }
  }

  async tableExists(tableName: string, schema?: string): Promise<boolean> {
    if (!this.db) {
      throw new Error("Not connected to SQLite database");
    }
    
    // In SQLite, schema parameter is ignored since SQLite doesn't support multiple schemas
    try {
      const row = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name = ?
      `).get(tableName) as SQLiteTableNameRow | undefined;
      
      return !!row;
    } catch (error) {
      throw error;
    }
  }

  async getTableSchema(tableName: string, schema?: string): Promise<TableColumn[]> {
    if (!this.db) {
      throw new Error("Not connected to SQLite database");
    }
    
    // In SQLite, schema parameter is ignored since SQLite doesn't support multiple schemas
    try {
      const rows = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as SQLiteTableInfo[];
      
      // Convert SQLite schema format to our standard TableColumn format
      const columns = rows.map(row => ({
        column_name: row.name,
        data_type: row.type,
        is_nullable: row.notnull === 0 ? 'YES' : 'NO', // In SQLite, 0 means nullable
        column_default: row.dflt_value
      }));
      
      return columns;
    } catch (error) {
      throw error;
    }
  }

  async executeQuery(query: string): Promise<QueryResult> {
    if (!this.db) {
      throw new Error("Not connected to SQLite database");
    }
    
    // Validate query for safety
    const safetyCheck = this.validateQuery(query);
    if (!safetyCheck.isValid) {
      throw new Error(safetyCheck.message || "Query validation failed");
    }

    try {
      const rows = this.db.prepare(query).all();
      return { rows };
    } catch (error) {
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

// Register the SQLite connector
const sqliteConnector = new SQLiteConnector();
ConnectorRegistry.register(sqliteConnector);