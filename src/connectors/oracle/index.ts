import { Connector, QueryResult, TableColumn, TableIndex, ConnectorRegistry, StoredProcedure } from '../interface.js';
import oracledb, { Connection, ExecuteManyOptions, ExecuteOptions, Pool, Result, BindParameters } from 'oracledb';

// Adjust output format for large numbers and dates if needed
// oracledb.fetchAsString = [ oracledb.NUMBER, oracledb.DATE, oracledb.TIMESTAMP_TZ ];

// Potentially increase the size of the Node.js thread pool if needed
// process.env.UV_THREADPOOL_SIZE = "10";

// Configure Oracle to return JavaScript values
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

// Oracle result row type interfaces
interface SchemaRow {
  SCHEMA_NAME: string;
}
interface TableRow {
  TABLE_NAME: string;
}
interface ColumnRow {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  IS_NULLABLE: string;
  COLUMN_DEFAULT: string | null;
}
interface IndexRow {
  INDEX_NAME: string;
  UNIQUENESS: string;
}
interface IndexColumnRow {
  COLUMN_NAME: string;
}
interface CountRow {
  COUNT: number;
}
interface SchemaInfoRow {
  SCHEMA: string;
}
interface ProcedureRow {
  OBJECT_NAME: string;
}
interface ProcedureTypeRow {
  OBJECT_TYPE: string;
}
interface SourceRow {
  TEXT: string;
}
interface ArgumentRow {
  ARGUMENT_NAME: string;
  IN_OUT: string;
  DATA_TYPE: string;
  DATA_LENGTH?: number;
  DATA_PRECISION?: number;
  DATA_SCALE?: number;
}
interface PrimaryKeyRow {
  IS_PK: number;
}

export class OracleConnector implements Connector {
  // Connector ID and Name are part of the Connector interface
  id: string = 'oracle';
  name: string = 'Oracle Database';

  private pool: Pool | null = null;
  private currentSchema: string | null = null;

  // constructor(config: ConnectionConfig) { // Removed config
  constructor() {
    // this.config = config;
    // Oracle specific initialization can go here
    // e.g., setting Thick mode if required
    // try {
    //   oracledb.initOracleClient({ libDir: process.env.ORACLE_LIB_DIR });
    // } catch (err) {
    //   console.error('Failed to initialize Oracle client:', err);
    //   // Handle error appropriately
    // }
    // Optionally set auto-commit to true for simpler transaction handling
    oracledb.autoCommit = true;
  }

  // Oracle DSN Parser implementation
  dsnParser = {
    parse: async (dsn: string): Promise<oracledb.PoolAttributes> => {
      if (!this.dsnParser.isValidDSN(dsn)) {
        throw new Error(`Invalid Oracle DSN: ${dsn}`);
      }

      try {
        const url = new URL(dsn);

        // Extract authentication details
        const username = url.username;
        const password = url.password;

        // Extract host and port
        const host = url.hostname;
        const port = url.port ? parseInt(url.port, 10) : 1521; // Default Oracle port is 1521

        // Extract service name or SID from pathname (remove leading slash)
        let serviceName = url.pathname;
        if (serviceName.startsWith('/')) {
          serviceName = serviceName.substring(1);
        }

        // Parse query parameters for additional options
        const connectString = `${host}:${port}/${serviceName}`;

        // Set up the connection config
        const config: oracledb.PoolAttributes = {
          user: username,
          password: password,
          connectString: connectString,
          poolMin: 0,
          poolMax: 10,
          poolIncrement: 1,
        };

        // Extract additional options from URL query parameters
        url.searchParams.forEach((value, key) => {
          switch (key.toLowerCase()) {
            case 'poolmin':
              config.poolMin = parseInt(value, 10);
              break;
            case 'poolmax':
              config.poolMax = parseInt(value, 10);
              break;
            case 'poolincrement':
              config.poolIncrement = parseInt(value, 10);
              break;
            // Add more options as needed
          }
        });

        return config;
      } catch (error) {
        throw new Error(`Failed to parse Oracle DSN: ${error instanceof Error ? error.message : String(error)}`);
      }
    },

    getSampleDSN: (): string => {
      return 'oracle://username:password@host:1521/service_name';
    },

    isValidDSN: (dsn: string): boolean => {
      try {
        const url = new URL(dsn);
        return url.protocol === 'oracle:';
      } catch (error) {
        return false;
      }
    },
  };

  async connect(dsn: string, initializationScript?: string): Promise<void> {
    try {
      const config = await this.dsnParser.parse(dsn);

      // Create a connection pool
      this.pool = await oracledb.createPool(config);

      // Get a connection to test and determine current schema
      const conn = await this.getConnection();
      try {
        const result = await conn.execute("SELECT SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') as SCHEMA FROM DUAL");
        if (result.rows && result.rows.length > 0) {
          this.currentSchema = (result.rows[0] as SchemaInfoRow).SCHEMA;
        }

        // Run initialization script if provided
        if (initializationScript) {
          await conn.execute(initializationScript);
        }
      } finally {
        await conn.close();
      }

      console.error('Successfully connected to Oracle database');
      if (this.currentSchema) {
        console.error(`Current schema: ${this.currentSchema}`);
      }
    } catch (error) {
      console.error('Failed to connect to Oracle database:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.close();
        this.pool = null;
        this.currentSchema = null;
      } catch (error) {
        console.error('Error disconnecting from Oracle:', error);
        throw error;
      }
    }
  }

  async getSchemas(): Promise<string[]> {
    try {
      const conn = await this.getConnection();
      try {
        // Query all schemas (users) that the current user has access to
        const result = await conn.execute(
          `SELECT USERNAME AS SCHEMA_NAME 
           FROM ALL_USERS 
           ORDER BY USERNAME`
        );

        return result.rows?.map((row) => (row as SchemaRow).SCHEMA_NAME) || [];
      } finally {
        await conn.close();
      }
    } catch (error) {
      console.error('Error getting schemas from Oracle:', error);
      throw error;
    }
  }

  async getTables(schemaName?: string): Promise<string[]> {
    try {
      const conn = await this.getConnection();
      try {
        const schema = schemaName || this.currentSchema;

        const result = await conn.execute(
          `SELECT TABLE_NAME 
           FROM ALL_TABLES 
           WHERE OWNER = :schema
           ORDER BY TABLE_NAME`,
          { schema: schema?.toUpperCase() }
        );

        return result.rows?.map((row) => (row as TableRow).TABLE_NAME) || [];
      } finally {
        await conn.close();
      }
    } catch (error) {
      console.error('Error getting tables from Oracle:', error);
      throw error;
    }
  }

  async getTableColumns(tableName: string, schemaName?: string): Promise<TableColumn[]> {
    try {
      const conn = await this.getConnection();
      try {
        const schema = schemaName || this.currentSchema;

        const result = await conn.execute(
          `SELECT 
             COLUMN_NAME, 
             DATA_TYPE,
             NULLABLE as IS_NULLABLE,
             DATA_DEFAULT as COLUMN_DEFAULT
           FROM ALL_TAB_COLUMNS
           WHERE OWNER = :schema
           AND TABLE_NAME = :tableName
           ORDER BY COLUMN_ID`,
          {
            schema: schema?.toUpperCase(),
            tableName: tableName.toUpperCase(),
          }
        );

        return (
          result.rows?.map((row) => ({
            column_name: (row as ColumnRow).COLUMN_NAME,
            data_type: (row as ColumnRow).DATA_TYPE,
            is_nullable: (row as ColumnRow).IS_NULLABLE === 'Y' ? 'YES' : 'NO',
            column_default: (row as ColumnRow).COLUMN_DEFAULT,
          })) || []
        );
      } finally {
        await conn.close();
      }
    } catch (error) {
      console.error('Error getting columns from Oracle:', error);
      throw error;
    }
  }

  // Method to ensure boolean return type
  private ensureBoolean(value: boolean | undefined): boolean {
    return value === true;
  }

  async getTableIndexes(tableName: string, schemaName?: string): Promise<TableIndex[]> {
    try {
      const conn = await this.getConnection();
      try {
        const schema = schemaName || this.currentSchema;

        // First, get all indexes for the table
        const indexesResult = await conn.execute(
          `SELECT 
             i.INDEX_NAME,
             i.UNIQUENESS
           FROM ALL_INDEXES i
           WHERE i.OWNER = :schema
           AND i.TABLE_NAME = :tableName`,
          {
            schema: schema?.toUpperCase(),
            tableName: tableName.toUpperCase(),
          }
        );

        if (!indexesResult.rows || indexesResult.rows.length === 0) {
          return [];
        }

        const indexes: TableIndex[] = [];

        // For each index, get its columns
        for (const idx of indexesResult.rows) {
          const indexRow = idx as IndexRow;
          const indexName = indexRow.INDEX_NAME;
          const isUnique = indexRow.UNIQUENESS === 'UNIQUE';

          const columnsResult = await conn.execute(
            `SELECT 
               COLUMN_NAME
             FROM ALL_IND_COLUMNS
             WHERE INDEX_OWNER = :schema
             AND INDEX_NAME = :indexName
             ORDER BY COLUMN_POSITION`,
            {
              schema: schema?.toUpperCase(),
              indexName: indexName,
            }
          );

          const columnNames = columnsResult.rows?.map((row) => (row as IndexColumnRow).COLUMN_NAME) || [];

          // Check if this is a primary key
          const pkResult = await conn.execute(
            `SELECT COUNT(*) AS IS_PK
             FROM ALL_CONSTRAINTS
             WHERE CONSTRAINT_TYPE = 'P'
             AND OWNER = :schema
             AND TABLE_NAME = :tableName
             AND INDEX_NAME = :indexName`,
            {
              schema: schema?.toUpperCase(),
              tableName: tableName.toUpperCase(),
              indexName: indexName,
            }
          );

          const isPrimary = pkResult.rows && pkResult.rows.length > 0 && (pkResult.rows[0] as PrimaryKeyRow).IS_PK > 0;

          indexes.push({
            index_name: indexName,
            column_names: columnNames,
            is_unique: isUnique,
            is_primary: !!isPrimary, // Ensure boolean
          });
        }

        return indexes;
      } finally {
        await conn.close();
      }
    } catch (error) {
      console.error('Error getting indexes from Oracle:', error);
      throw error;
    }
  }

  async tableExists(tableName: string, schemaName?: string): Promise<boolean> {
    try {
      const conn = await this.getConnection();
      try {
        const schema = schemaName || this.currentSchema;

        const result = await conn.execute(
          `SELECT COUNT(*) AS COUNT
           FROM ALL_TABLES
           WHERE OWNER = :schema
           AND TABLE_NAME = :tableName`,
          {
            schema: schema?.toUpperCase(),
            tableName: tableName.toUpperCase(),
          }
        );

        // Ensure we return a boolean
        return !!(result.rows && result.rows.length > 0 && (result.rows[0] as CountRow).COUNT > 0);
      } finally {
        await conn.close();
      }
    } catch (error) {
      console.error('Error checking table existence in Oracle:', error);
      throw error;
    }
  }

  async getTableSchema(tableName: string, schema?: string | undefined): Promise<TableColumn[]> {
    // This seems redundant with getTableColumns, delegate for now
    return this.getTableColumns(tableName, schema);
  }

  async getStoredProcedures(schema?: string): Promise<string[]> {
    try {
      const conn = await this.getConnection();
      try {
        const schemaName = schema || this.currentSchema;

        const result = await conn.execute(
          `SELECT OBJECT_NAME
           FROM ALL_OBJECTS
           WHERE OWNER = :schema
           AND OBJECT_TYPE IN ('PROCEDURE', 'FUNCTION')
           ORDER BY OBJECT_NAME`,
          { schema: schemaName?.toUpperCase() }
        );

        return result.rows?.map((row) => (row as ProcedureRow).OBJECT_NAME) || [];
      } finally {
        await conn.close();
      }
    } catch (error) {
      console.error('Error getting stored procedures from Oracle:', error);
      throw error;
    }
  }

  async getStoredProcedureDetail(procedureName: string, schema?: string): Promise<StoredProcedure> {
    try {
      const conn = await this.getConnection();
      try {
        const schemaName = schema || this.currentSchema;

        // Get procedure type (PROCEDURE or FUNCTION)
        const typeResult = await conn.execute(
          `SELECT OBJECT_TYPE
           FROM ALL_OBJECTS
           WHERE OWNER = :schema
           AND OBJECT_NAME = :procName`,
          {
            schema: schemaName?.toUpperCase(),
            procName: procedureName.toUpperCase(),
          }
        );

        if (!typeResult.rows || typeResult.rows.length === 0) {
          throw new Error(`Procedure or function ${procedureName} not found`);
        }

        const objectType = (typeResult.rows[0] as ProcedureTypeRow).OBJECT_TYPE;
        const isProcedure = objectType === 'PROCEDURE';

        // Get procedure text (source code)
        const sourceResult = await conn.execute(
          `SELECT TEXT
           FROM ALL_SOURCE
           WHERE OWNER = :schema
           AND NAME = :procName
           AND TYPE = :objectType
           ORDER BY LINE`,
          {
            schema: schemaName?.toUpperCase(),
            procName: procedureName.toUpperCase(),
            objectType,
          }
        );

        let definition = '';
        if (sourceResult.rows && sourceResult.rows.length > 0) {
          definition = sourceResult.rows.map((row) => (row as SourceRow).TEXT).join('');
        }

        // Get parameters
        const paramsResult = await conn.execute(
          `SELECT 
             ARGUMENT_NAME,
             IN_OUT,
             DATA_TYPE,
             DATA_LENGTH,
             DATA_PRECISION,
             DATA_SCALE
           FROM ALL_ARGUMENTS
           WHERE OWNER = :schema
           AND OBJECT_NAME = :procName
           AND POSITION > 0
           ORDER BY SEQUENCE`,
          {
            schema: schemaName?.toUpperCase(),
            procName: procedureName.toUpperCase(),
          }
        );

        let parameterList = '';
        let returnType = '';

        if (paramsResult.rows && paramsResult.rows.length > 0) {
          const params = paramsResult.rows
            .map((row) => {
              const argRow = row as ArgumentRow;
              if (argRow.IN_OUT === 'OUT' && !isProcedure) {
                // For functions, the return value is marked as an OUT parameter
                returnType = formatOracleDataType(
                  argRow.DATA_TYPE,
                  argRow.DATA_LENGTH,
                  argRow.DATA_PRECISION,
                  argRow.DATA_SCALE
                );
                return null;
              }

              const paramType = formatOracleDataType(
                argRow.DATA_TYPE,
                argRow.DATA_LENGTH,
                argRow.DATA_PRECISION,
                argRow.DATA_SCALE
              );

              return `${argRow.ARGUMENT_NAME} ${argRow.IN_OUT} ${paramType}`;
            })
            .filter(Boolean);

          parameterList = params.join(', ');
        }

        return {
          procedure_name: procedureName,
          procedure_type: isProcedure ? 'procedure' : 'function',
          language: 'PL/SQL',
          parameter_list: parameterList,
          return_type: returnType || undefined,
          definition: definition || undefined,
        };
      } finally {
        await conn.close();
      }
    } catch (error) {
      console.error('Error getting stored procedure details from Oracle:', error);
      throw error;
    }
  }

  async executeQuery(query: string): Promise<QueryResult> {
    return this.runQuery(query);
  }

  validateQuery(query: string): { isValid: boolean; message?: string } {
    // Basic validation to prevent destructive operations
    const lowerQuery = query.toLowerCase().trim();

    // Disallow DDL and DML operations that could modify data/schema
    if (
      lowerQuery.startsWith('drop ') ||
      lowerQuery.startsWith('alter ') ||
      lowerQuery.startsWith('create ') ||
      lowerQuery.startsWith('truncate ') ||
      lowerQuery.startsWith('delete ') ||
      lowerQuery.startsWith('update ') ||
      lowerQuery.startsWith('insert ') ||
      lowerQuery.startsWith('grant ') ||
      lowerQuery.startsWith('revoke ')
    ) {
      return {
        isValid: false,
        message: 'Data modification and schema modification operations are not allowed.',
      };
    }

    return { isValid: true };
  }

  async runQuery(sql: string, params?: any[]): Promise<QueryResult> {
    try {
      const conn = await this.getConnection();
      try {
        // Transform parameters to named binding format if provided
        let bindParams: any = undefined;
        if (params && params.length > 0) {
          bindParams = {};
          // Oracle uses named parameters like :param1, :param2
          // We'll transform array parameters to this format
          for (let i = 0; i < params.length; i++) {
            bindParams[`param${i + 1}`] = params[i];
          }

          // Replace ? with named parameters in SQL
          let paramIndex = 1;
          sql = sql.replace(/\?/g, () => `:param${paramIndex++}`);
        }

        const options = {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
          autoCommit: true,
        };

        // validate query
        const validationResult = this.validateQuery(sql);
        if (!validationResult.isValid) {
          throw new Error(validationResult.message);
        }

        const result = await conn.execute(sql, bindParams || {}, options);

        return {
          rows: result.rows || [],
          rowCount: result.rows?.length || 0,
          fields:
            result.metaData?.map((col) => ({
              name: col.name,
              type: col.dbType?.toString() || 'UNKNOWN',
            })) || [],
        };
      } finally {
        await conn.close();
      }
    } catch (error) {
      console.error('Error executing query in Oracle:', error);
      throw error;
    }
  }

  // Helper method to get a connection from the pool
  private async getConnection(): Promise<Connection> {
    if (!this.pool) {
      throw new Error('Connection pool not initialized. Call connect() first.');
    }
    return this.pool.getConnection();
  }
}

// Helper function to format Oracle data types
function formatOracleDataType(
  dataType: string,
  dataLength?: number,
  dataPrecision?: number,
  dataScale?: number
): string {
  if (!dataType) {
    return 'UNKNOWN';
  }

  switch (dataType.toUpperCase()) {
    case 'VARCHAR2':
    case 'CHAR':
    case 'NVARCHAR2':
    case 'NCHAR':
      return `${dataType}(${dataLength || ''})`;
    case 'NUMBER':
      if (dataPrecision !== undefined && dataScale !== undefined) {
        return `NUMBER(${dataPrecision}, ${dataScale})`;
      } else if (dataPrecision !== undefined) {
        return `NUMBER(${dataPrecision})`;
      }
      return 'NUMBER';
    default:
      return dataType;
  }
}

// Register the connector
ConnectorRegistry.register(new OracleConnector());
