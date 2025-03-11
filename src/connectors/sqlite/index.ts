/**
 * SQLite Connector Implementation (Template)
 * 
 * This is a template showing how to implement a new database connector.
 * To use this connector:
 * 1. Install the required dependencies: npm install sqlite3
 * 2. Implement the methods below
 * 3. Set DB_DSN=sqlite:///path/to/database.db in your .env file
 */

import { Connector, ConnectorRegistry, DSNParser, QueryResult, TableColumn } from '../../interfaces/connector.js';

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

export class SQLiteConnector implements Connector {
  id = 'sqlite';
  name = 'SQLite';
  dsnParser = new SQLiteDSNParser();
  
  private db: any; // This would be the SQLite connection
  private dbPath: string | null = null;

  async connect(dsn: string): Promise<void> {
    const config = this.dsnParser.parse(dsn);
    this.dbPath = config.dbPath;
    
    // Example implementation (requires sqlite3 package)
    /*
    return new Promise((resolve, reject) => {
      const sqlite3 = require('sqlite3').verbose();
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error("Failed to connect to SQLite database:", err);
          reject(err);
        } else {
          console.error("Successfully connected to SQLite database");
          resolve();
        }
      });
    });
    */
    throw new Error('SQLite connector not implemented yet');
  }

  async disconnect(): Promise<void> {
    // Close the SQLite connection
    /*
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            this.db = null;
            resolve();
          }
        });
      });
    }
    */
    throw new Error('SQLite connector not implemented yet');
  }

  async getTables(): Promise<string[]> {
    // Get all tables from SQLite
    /*
    return new Promise((resolve, reject) => {
      this.db.all(
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
    */
    throw new Error('SQLite connector not implemented yet');
  }

  async tableExists(tableName: string): Promise<boolean> {
    // Check if a table exists in SQLite
    /*
    return new Promise((resolve, reject) => {
      this.db.get(
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
    */
    throw new Error('SQLite connector not implemented yet');
  }

  async getTableSchema(tableName: string): Promise<TableColumn[]> {
    // Get schema for a specific table
    /*
    return new Promise((resolve, reject) => {
      this.db.all(
        `PRAGMA table_info(${tableName})`,
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            // Convert SQLite schema format to our standard TableColumn format
            const columns = rows.map(row => ({
              column_name: row.name,
              data_type: row.type,
              is_nullable: row.notnull ? 'NO' : 'YES',
              column_default: row.dflt_value
            }));
            resolve(columns);
          }
        }
      );
    });
    */
    throw new Error('SQLite connector not implemented yet');
  }

  async executeQuery(query: string): Promise<QueryResult> {
    // Execute a query against SQLite
    const safetyCheck = this.validateQuery(query);
    if (!safetyCheck.isValid) {
      throw new Error(safetyCheck.message || "Query validation failed");
    }

    /*
    return new Promise((resolve, reject) => {
      this.db.all(query, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve({ rows });
        }
      });
    });
    */
    throw new Error('SQLite connector not implemented yet');
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

// To enable this connector, uncomment the following lines and install sqlite3:
// const sqliteConnector = new SQLiteConnector();
// ConnectorRegistry.register(sqliteConnector);