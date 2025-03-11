/**
 * Database Connector Interface
 * This defines the contract that all database connectors must implement.
 */
export interface QueryResult {
  rows: any[];
  [key: string]: any;
}

export interface TableColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

export interface Connector {
  /** A unique identifier for the connector */
  id: string;
  
  /** Human-readable name of the connector */
  name: string;
  
  /** Connect to the database */
  connect(): Promise<void>;
  
  /** Close the connection */
  disconnect(): Promise<void>;
  
  /** Get all tables in the database */
  getTables(): Promise<string[]>;
  
  /** Get schema information for a specific table */
  getTableSchema(tableName: string): Promise<TableColumn[]>;
  
  /** Check if a table exists */
  tableExists(tableName: string): Promise<boolean>;
  
  /** Execute a query */
  executeQuery(query: string): Promise<QueryResult>;
  
  /** Validate query for safety (preventing destructive operations) */
  validateQuery(query: string): { isValid: boolean; message?: string };
}

/**
 * Factory function type for creating connector instances
 */
export type ConnectorFactory = () => Connector;

/**
 * Registry for available database connectors
 */
export class ConnectorRegistry {
  private static connectors: Map<string, ConnectorFactory> = new Map();

  /**
   * Register a new connector
   */
  static register(id: string, factory: ConnectorFactory): void {
    ConnectorRegistry.connectors.set(id, factory);
  }

  /**
   * Get a connector by ID
   */
  static getConnector(id: string): Connector | null {
    const factory = ConnectorRegistry.connectors.get(id);
    if (!factory) return null;
    return factory();
  }

  /**
   * Get all available connector IDs
   */
  static getAvailableConnectors(): string[] {
    return Array.from(ConnectorRegistry.connectors.keys());
  }
}