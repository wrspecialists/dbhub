import { Connector, ConnectorRegistry } from '../interfaces/connector.js';

/**
 * Manages database connectors and provides a unified interface to work with them
 */
export class ConnectorManager {
  private activeConnector: Connector | null = null;
  private connectorType: string = 'postgres'; // Default connector

  constructor(connectorType?: string) {
    if (connectorType) {
      this.connectorType = connectorType;
    }
  }

  /**
   * Initialize and connect to the selected database
   */
  async initialize(): Promise<void> {
    // Get the connector from the registry
    const connector = ConnectorRegistry.getConnector(this.connectorType);
    
    if (!connector) {
      throw new Error(`Connector "${this.connectorType}" not found`);
    }
    
    this.activeConnector = connector;
    
    // Connect to the database
    await this.activeConnector.connect();
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.activeConnector) {
      await this.activeConnector.disconnect();
      this.activeConnector = null;
    }
  }

  /**
   * Get the active connector
   */
  getConnector(): Connector {
    if (!this.activeConnector) {
      throw new Error('No active connector. Call initialize() first.');
    }
    return this.activeConnector;
  }

  /**
   * Get all available connector types
   */
  static getAvailableConnectors(): string[] {
    return ConnectorRegistry.getAvailableConnectors();
  }
}