import mysql from 'mysql2/promise';
import { Connector, ConnectorRegistry, DSNParser, QueryResult, TableColumn, TableIndex, StoredProcedure } from '../interface.js';

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

  async getSchemas(): Promise<string[]> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }
    
    try {
      // In MySQL, schemas are equivalent to databases
      const [rows] = await this.pool.query(`
        SELECT schema_name 
        FROM information_schema.schemata
        ORDER BY schema_name
      `) as [any[], any];
      
      return rows.map(row => row.schema_name);
    } catch (error) {
      console.error("Error getting schemas:", error);
      throw error;
    }
  }

  async getTables(schema?: string): Promise<string[]> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }
    
    try {
      // In MySQL, if no schema is provided, use the current active database (DATABASE())
      // MySQL uses the terms 'database' and 'schema' interchangeably
      // The DATABASE() function returns the current database context
      const schemaClause = schema ? 
        'WHERE table_schema = ?' : 
        'WHERE table_schema = DATABASE()';

      const queryParams = schema ? [schema] : [];
      
      // Get all tables from the specified schema or current database
      const [rows] = await this.pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        ${schemaClause}
        ORDER BY table_name
      `, queryParams) as [any[], any];
      
      return rows.map(row => row.table_name);
    } catch (error) {
      console.error("Error getting tables:", error);
      throw error;
    }
  }

  async tableExists(tableName: string, schema?: string): Promise<boolean> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }
    
    try {
      // In MySQL, if no schema is provided, use the current active database
      // DATABASE() function returns the name of the current database
      const schemaClause = schema ? 
        'WHERE table_schema = ?' : 
        'WHERE table_schema = DATABASE()';

      const queryParams = schema ? [schema, tableName] : [tableName];

      const [rows] = await this.pool.query(`
        SELECT COUNT(*) as count
        FROM information_schema.tables 
        ${schemaClause} 
        AND table_name = ?
      `, queryParams) as [any[], any];
      
      return rows[0].count > 0;
    } catch (error) {
      console.error("Error checking if table exists:", error);
      throw error;
    }
  }

  async getTableIndexes(tableName: string, schema?: string): Promise<TableIndex[]> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }
    
    try {
      // In MySQL, if no schema is provided, use the current active database
      const schemaClause = schema ? 
        'TABLE_SCHEMA = ?' : 
        'TABLE_SCHEMA = DATABASE()';

      const queryParams = schema ? [schema, tableName] : [tableName];
      
      // Get information about indexes
      const [indexRows] = await this.pool.query(`
        SELECT 
          INDEX_NAME,
          COLUMN_NAME,
          NON_UNIQUE,
          SEQ_IN_INDEX
        FROM 
          information_schema.STATISTICS 
        WHERE 
          ${schemaClause}
          AND TABLE_NAME = ? 
        ORDER BY 
          INDEX_NAME, 
          SEQ_IN_INDEX
      `, queryParams) as [any[], any];
      
      // Process the results to group columns by index
      const indexMap = new Map<string, {
        columns: string[],
        is_unique: boolean,
        is_primary: boolean
      }>();
      
      for (const row of indexRows) {
        const indexName = row.INDEX_NAME;
        const columnName = row.COLUMN_NAME;
        const isUnique = row.NON_UNIQUE === 0; // In MySQL, NON_UNIQUE=0 means the index is unique
        const isPrimary = indexName === 'PRIMARY';
        
        if (!indexMap.has(indexName)) {
          indexMap.set(indexName, {
            columns: [],
            is_unique: isUnique,
            is_primary: isPrimary
          });
        }
        
        const indexInfo = indexMap.get(indexName)!;
        indexInfo.columns.push(columnName);
      }
      
      // Convert the map to the expected TableIndex format
      const results: TableIndex[] = [];
      indexMap.forEach((indexInfo, indexName) => {
        results.push({
          index_name: indexName,
          column_names: indexInfo.columns,
          is_unique: indexInfo.is_unique,
          is_primary: indexInfo.is_primary
        });
      });
      
      return results;
    } catch (error) {
      console.error("Error getting table indexes:", error);
      throw error;
    }
  }

  async getTableSchema(tableName: string, schema?: string): Promise<TableColumn[]> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }
    
    try {
      // In MySQL, schema is synonymous with database
      // If no schema is provided, use the current database context via DATABASE() function
      // This means tables will be retrieved from whatever database the connection is currently using
      const schemaClause = schema ? 
        'WHERE table_schema = ?' : 
        'WHERE table_schema = DATABASE()';

      const queryParams = schema ? [schema, tableName] : [tableName];

      // Get table columns
      const [rows] = await this.pool.query(`
        SELECT 
          column_name, 
          data_type, 
          is_nullable,
          column_default
        FROM information_schema.columns
        ${schemaClause}
        AND table_name = ?
        ORDER BY ordinal_position
      `, queryParams) as [any[], any];
      
      return rows;
    } catch (error) {
      console.error("Error getting table schema:", error);
      throw error;
    }
  }

  async getStoredProcedures(schema?: string): Promise<string[]> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }
    
    try {
      // In MySQL, if no schema is provided, use the current database context
      const schemaClause = schema ? 
        'WHERE routine_schema = ?' : 
        'WHERE routine_schema = DATABASE()';

      const queryParams = schema ? [schema] : [];
      
      // Get all stored procedures and functions
      const [rows] = await this.pool.query(`
        SELECT routine_name
        FROM information_schema.routines
        ${schemaClause}
        ORDER BY routine_name
      `, queryParams) as [any[], any];
      
      return rows.map(row => row.routine_name);
    } catch (error) {
      console.error("Error getting stored procedures:", error);
      throw error;
    }
  }

  async getStoredProcedureDetail(procedureName: string, schema?: string): Promise<StoredProcedure> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }
    
    try {
      // In MySQL, if no schema is provided, use the current database context
      const schemaClause = schema ? 
        'WHERE r.routine_schema = ?' : 
        'WHERE r.routine_schema = DATABASE()';

      const queryParams = schema ? [schema, procedureName] : [procedureName];
      
      // Get details of the stored procedure
      const [rows] = await this.pool.query(`
        SELECT 
          r.routine_name AS procedure_name,
          CASE 
            WHEN r.routine_type = 'PROCEDURE' THEN 'procedure'
            ELSE 'function'
          END AS procedure_type,
          LOWER(r.routine_type) AS routine_type,
          r.routine_definition,
          r.dtd_identifier AS return_type,
          (
            SELECT GROUP_CONCAT(
              CONCAT(p.parameter_name, ' ', p.parameter_mode, ' ', p.data_type)
              ORDER BY p.ordinal_position
              SEPARATOR ', '
            )
            FROM information_schema.parameters p
            WHERE p.specific_schema = r.routine_schema
            AND p.specific_name = r.routine_name
            AND p.parameter_name IS NOT NULL
          ) AS parameter_list
        FROM information_schema.routines r
        ${schemaClause}
        AND r.routine_name = ?
      `, queryParams) as [any[], any];
      
      if (rows.length === 0) {
        const schemaName = schema || 'current schema';
        throw new Error(`Stored procedure '${procedureName}' not found in ${schemaName}`);
      }
      
      const procedure = rows[0];

      // If routine_definition is NULL, try to get the procedure body from mysql.proc
      let definition = procedure.routine_definition;
      
      try {
        const schemaValue = schema || await this.getCurrentSchema();
        
        // For full definition - different approaches based on type
        if (procedure.procedure_type === 'procedure') {
          // Try to get the definition from SHOW CREATE PROCEDURE
          try {
            const [defRows] = await this.pool.query(`
              SHOW CREATE PROCEDURE ${schemaValue}.${procedureName}
            `) as [any[], any];
            
            if (defRows && defRows.length > 0) {
              definition = defRows[0]['Create Procedure'];
            }
          } catch (err) {
            console.error(`Error getting procedure definition with SHOW CREATE: ${err}`);
          }
        } else {
          // Try to get the definition for functions
          try {
            const [defRows] = await this.pool.query(`
              SHOW CREATE FUNCTION ${schemaValue}.${procedureName}
            `) as [any[], any];
            
            if (defRows && defRows.length > 0) {
              definition = defRows[0]['Create Function'];
            }
          } catch (innerErr) {
            console.error(`Error getting function definition with SHOW CREATE: ${innerErr}`);
          }
        }
        
        // Last attempt - try to get from information_schema.routines if not found yet
        if (!definition) {
          const [bodyRows] = await this.pool.query(`
            SELECT routine_definition, routine_body 
            FROM information_schema.routines
            WHERE routine_schema = ? AND routine_name = ?
          `, [schemaValue, procedureName]) as [any[], any];
          
          if (bodyRows && bodyRows.length > 0) {
            if (bodyRows[0].routine_definition) {
              definition = bodyRows[0].routine_definition;
            } else if (bodyRows[0].routine_body) {
              definition = bodyRows[0].routine_body;
            }
          }
        }
      } catch (error) {
        // Ignore errors when getting definition - it's optional
        console.error(`Error getting procedure/function details: ${error}`);
      }
      
      return {
        procedure_name: procedure.procedure_name,
        procedure_type: procedure.procedure_type,
        language: 'sql', // MySQL procedures are generally in SQL
        parameter_list: procedure.parameter_list || '',
        return_type: procedure.routine_type === 'function' ? procedure.return_type : undefined,
        definition: definition || undefined
      };
    } catch (error) {
      console.error("Error getting stored procedure detail:", error);
      throw error;
    }
  }

  // Helper method to get current schema (database) name
  private async getCurrentSchema(): Promise<string> {
    const [rows] = await this.pool!.query('SELECT DATABASE() as db') as [any[], any];
    return rows[0].db;
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