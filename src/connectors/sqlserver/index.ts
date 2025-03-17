import sql from 'mssql';
import { Connector, ConnectorRegistry, DSNParser, QueryResult, TableColumn } from '../interface.js';

/**
 * SQL Server DSN parser
 * Expected format: mssql://username:password@host:port/database
 */
export class SQLServerDSNParser implements DSNParser {
  parse(dsn: string): sql.config {
    // Remove the protocol prefix
    if (!this.isValidDSN(dsn)) {
      throw new Error('Invalid SQL Server DSN format. Expected: sqlserver://username:password@host:port/database');
    }

    // Parse the DSN
    const url = new URL(dsn);
    const host = url.hostname;
    const port = url.port ? parseInt(url.port, 10) : 1433; // Default SQL Server port
    const database = url.pathname.substring(1); // Remove leading slash
    const user = url.username;
    const password = url.password;

    // Parse additional options from query parameters
    const options: Record<string, any> = {};
    for (const [key, value] of url.searchParams.entries()) {
      if (key === 'encrypt') {
        options.encrypt = value;
      } else if (key === 'trustServerCertificate') {
        options.trustServerCertificate = value === 'true';
      } else if (key === 'connectTimeout') {
        options.connectTimeout = parseInt(value, 10);
      } else if (key === 'requestTimeout') {
        options.requestTimeout = parseInt(value, 10);
      }
    }

    // Construct and return the config
    return {
      user,
      password,
      server: host,
      port,
      database,
      options: {
        encrypt: options.encrypt ?? true, // Default to encrypted connection
        trustServerCertificate: options.trustServerCertificate === true, // Need explicit conversion to boolean
        connectTimeout: options.connectTimeout ?? 15000,
        requestTimeout: options.requestTimeout ?? 15000,
      },
    };
  }

  getSampleDSN(): string {
    return 'sqlserver://username:password@localhost:1433/database?encrypt=true';
  }

  isValidDSN(dsn: string): boolean {
    try {
      const url = new URL(dsn);
      return url.protocol === 'sqlserver:';
    } catch (e) {
      return false;
    }
  }
}

/**
 * SQL Server connector
 */
export class SQLServerConnector implements Connector {
  id = 'sqlserver';
  name = 'SQL Server';
  dsnParser = new SQLServerDSNParser();

  private connection?: sql.ConnectionPool;
  private config?: sql.config;

  async connect(dsn: string): Promise<void> {
    try {
      this.config = this.dsnParser.parse(dsn);
      
      if (!this.config.options) {
        this.config.options = {};
      }
      
      this.connection = await new sql.ConnectionPool(this.config).connect();
    } catch (error) {
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = undefined;
    }
  }

  async getTables(): Promise<string[]> {
    if (!this.connection) {
      throw new Error('Not connected to SQL Server database');
    }

    try {
      const result = await this.connection.request().query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        ORDER BY TABLE_NAME
      `);

      return result.recordset.map((row) => row.TABLE_NAME);
    } catch (error) {
      throw new Error(`Failed to get tables: ${(error as Error).message}`);
    }
  }

  async tableExists(tableName: string): Promise<boolean> {
    if (!this.connection) {
      throw new Error('Not connected to SQL Server database');
    }

    try {
      const result = await this.connection.request()
        .input('tableName', sql.VarChar, tableName)
        .query(`
          SELECT COUNT(*) as count
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_NAME = @tableName
        `);

      return result.recordset[0].count > 0;
    } catch (error) {
      throw new Error(`Failed to check if table exists: ${(error as Error).message}`);
    }
  }

  async getTableSchema(tableName: string): Promise<TableColumn[]> {
    if (!this.connection) {
      throw new Error('Not connected to SQL Server database');
    }

    try {
      const result = await this.connection.request()
        .input('tableName', sql.VarChar, tableName)
        .query(`
          SELECT 
            COLUMN_NAME as column_name,
            DATA_TYPE as data_type,
            IS_NULLABLE as is_nullable,
            COLUMN_DEFAULT as column_default
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = @tableName
          ORDER BY ORDINAL_POSITION
        `);

      return result.recordset;
    } catch (error) {
      throw new Error(`Failed to get schema for table ${tableName}: ${(error as Error).message}`);
    }
  }

  async executeQuery(query: string): Promise<QueryResult> {
    if (!this.connection) {
      throw new Error('Not connected to SQL Server database');
    }

    const safetyCheck = this.validateQuery(query);
    if (!safetyCheck.isValid) {
      throw new Error(safetyCheck.message || "Query validation failed");
    }

    try {
      const result = await this.connection.request().query(query);
      return {
        rows: result.recordset || [],
        fields: result.recordset && result.recordset.length > 0
          ? Object.keys(result.recordset[0]).map(key => ({
              name: key,
            }))
          : [],
        rowCount: result.rowsAffected[0] || 0,
      };
    } catch (error) {
      throw new Error(`Failed to execute query: ${(error as Error).message}`);
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
const sqlServerConnector = new SQLServerConnector();
ConnectorRegistry.register(sqlServerConnector);
