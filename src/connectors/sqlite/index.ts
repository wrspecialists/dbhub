/**
 * SQLite Connector Implementation
 * 
 * Implements SQLite database connectivity for DBHub
 * To use this connector:
 * 1. Set DSN=sqlite:///path/to/database.db in your .env file
 * 2. Or set DB_CONNECTOR_TYPE=sqlite for default in-memory database
 */

import { Connector, ConnectorRegistry, DSNParser, QueryResult, TableColumn } from '../interface.js';
import sqlite3 from 'sqlite3';

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
  
  private db: sqlite3.Database | null = null;
  private dbPath: string = ':memory:'; // Default to in-memory database

  async connect(dsn: string, initScript?: string): Promise<void> {
    const config = this.dsnParser.parse(dsn);
    this.dbPath = config.dbPath;
    
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error("Failed to connect to SQLite database:", err);
          reject(err);
        } else {
          // Can't use console.log here because it will break the stdio transport
          console.error("Successfully connected to SQLite database");
          
          // If an initialization script is provided, run it
          if (initScript) {
            this.db!.exec(initScript, (err) => {
              if (err) {
                console.error("Failed to initialize database with script:", err);
                reject(err);
              } else {
                console.error("Successfully initialized database with script");
                resolve();
              }
            });
          } else {
            resolve();
          }
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    // Close the SQLite connection
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db!.close((err) => {
          if (err) {
            reject(err);
          } else {
            this.db = null;
            resolve();
          }
        });
      });
    }
    return Promise.resolve();
  }

  async getTables(): Promise<string[]> {
    if (!this.db) {
      throw new Error("Not connected to SQLite database");
    }
    
    return new Promise((resolve, reject) => {
      this.db!.all<SQLiteTableNameRow>(
        `SELECT name FROM sqlite_master 
         WHERE type='table' AND name NOT LIKE 'sqlite_%'
         ORDER BY name`,
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows.map(row => row.name));
          }
        }
      );
    });
  }

  async tableExists(tableName: string): Promise<boolean> {
    if (!this.db) {
      throw new Error("Not connected to SQLite database");
    }
    
    return new Promise((resolve, reject) => {
      this.db!.get<SQLiteTableNameRow>(
        `SELECT name FROM sqlite_master 
         WHERE type='table' AND name = ?`,
        [tableName],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(!!row);
          }
        }
      );
    });
  }

  async getTableSchema(tableName: string): Promise<TableColumn[]> {
    if (!this.db) {
      throw new Error("Not connected to SQLite database");
    }
    
    return new Promise((resolve, reject) => {
      this.db!.all<SQLiteTableInfo>(
        `PRAGMA table_info(${tableName})`,
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            // Convert SQLite schema format to our standard TableColumn format
            const columns = rows.map(row => ({
              column_name: row.name,
              data_type: row.type,
              is_nullable: row.notnull === 0 ? 'YES' : 'NO', // In SQLite, 0 means nullable
              column_default: row.dflt_value
            }));
            resolve(columns);
          }
        }
      );
    });
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

    return new Promise((resolve, reject) => {
      this.db!.all(query, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve({ rows });
        }
      });
    });
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