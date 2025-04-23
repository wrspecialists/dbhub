import { Connector, ConnectorRegistry } from "./interface.js";

// Singleton instance for global access
let managerInstance: ConnectorManager | null = null;

/**
 * Manages database connectors and provides a unified interface to work with them
 */
export class ConnectorManager {
  private activeConnector: Connector | null = null;
  private connected = false;

  constructor() {
    if (!managerInstance) {
      managerInstance = this;
    }
  }

  /**
   * Initialize and connect to the database using a DSN
   */
  async connectWithDSN(dsn: string, initScript?: string): Promise<void> {
    // First try to find a connector that can handle this DSN
    let connector = ConnectorRegistry.getConnectorForDSN(dsn);

    if (!connector) {
      throw new Error(`No connector found that can handle the DSN: ${dsn}`);
    }

    this.activeConnector = connector;

    // Connect to the database
    await this.activeConnector.connect(dsn, initScript);
    this.connected = true;
  }

  /**
   * Initialize and connect to the database using a specific connector type
   */
  async connectWithType(connectorType: string, dsn?: string): Promise<void> {
    // Get the connector from the registry
    const connector = ConnectorRegistry.getConnector(connectorType);

    if (!connector) {
      throw new Error(`Connector "${connectorType}" not found`);
    }

    this.activeConnector = connector;

    // Use provided DSN or get sample DSN
    const connectionString = dsn || connector.dsnParser.getSampleDSN();

    // Connect to the database
    await this.activeConnector.connect(connectionString);
    this.connected = true;
  }

  /**
   * Close the database connection
   */
  async disconnect(): Promise<void> {
    if (this.activeConnector && this.connected) {
      await this.activeConnector.disconnect();
      this.connected = false;
    }
  }

  /**
   * Get the active connector
   */
  getConnector(): Connector {
    if (!this.activeConnector) {
      throw new Error("No active connector. Call connectWithDSN() or connectWithType() first.");
    }
    return this.activeConnector;
  }

  /**
   * Check if there's an active connection
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get all available connector types
   */
  static getAvailableConnectors(): string[] {
    return ConnectorRegistry.getAvailableConnectors();
  }

  /**
   * Get sample DSNs for all available connectors
   */
  static getAllSampleDSNs(): { [connectorId: string]: string } {
    return ConnectorRegistry.getAllSampleDSNs();
  }

  /**
   * Get the current active connector instance
   * This is used by resource and tool handlers
   */
  static getCurrentConnector(): Connector {
    if (!managerInstance) {
      throw new Error("ConnectorManager not initialized");
    }
    return managerInstance.getConnector();
  }
}
