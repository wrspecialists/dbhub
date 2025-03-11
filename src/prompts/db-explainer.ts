import { z } from "zod";
import { ConnectorManager } from '../connectors/manager.js';
import { formatPromptSuccessResponse, formatPromptErrorResponse } from '../utils/response-formatter.js';

// Schema for database explainer prompt
export const dbExplainerSchema = {
  target: z.string().describe("Name of the table, column, or database to explain")
};

/**
 * Database Explainer Prompt Handler
 * Provides explanations about database elements
 */
export async function dbExplainerPromptHandler({ target }: { target: string }, _extra: any) {
  try {
    const connector = ConnectorManager.getCurrentConnector();
    
    // First check if this is a table name
    const tables = await connector.getTables();
    const normalizedTarget = target.toLowerCase();
    
    // Check if target matches a table
    const matchingTable = tables.find(t => t.toLowerCase() === normalizedTarget);
    if (matchingTable) {
      // Explain the table
      const columns = await connector.getTableSchema(matchingTable);
      
      // Create a table structure description
      const tableDescription = `Table: ${matchingTable}
      
Structure:
${columns.map(col => `- ${col.column_name} (${col.data_type})${col.is_nullable === 'YES' ? ', nullable' : ''}${col.column_default ? `, default: ${col.column_default}` : ''}`).join('\n')}

Purpose:
This table appears to store ${determineTablePurpose(matchingTable, columns)}

Relationships:
${determineRelationships(matchingTable, columns)}`;

      return formatPromptSuccessResponse(tableDescription);
    }
    
    // Check if target is a table.column format
    if (target.includes('.')) {
      const [tableName, columnName] = target.split('.');
      if (tables.find(t => t.toLowerCase() === tableName.toLowerCase())) {
        // Get column info
        const columns = await connector.getTableSchema(tableName);
        const column = columns.find(c => c.column_name.toLowerCase() === columnName.toLowerCase());
        
        if (column) {
          const columnDescription = `Column: ${tableName}.${column.column_name}
          
Type: ${column.data_type}
Nullable: ${column.is_nullable === 'YES' ? 'Yes' : 'No'}
Default: ${column.column_default || 'None'}

Purpose:
${determineColumnPurpose(column.column_name, column.data_type)}`;

          return formatPromptSuccessResponse(columnDescription);
        }
      }
    }
    
    // If target is not a specific table or column, provide database overview
    // Determine if 'database' or similar term is in the target
    if (['database', 'db', 'schema', 'overview', 'all'].includes(normalizedTarget)) {
      let dbOverview = `Database Overview

Tables: ${tables.length}
${tables.map(t => `- ${t}`).join('\n')}

This database ${describeDatabasePurpose(tables)}`;

      return formatPromptSuccessResponse(dbOverview);
    }
    
    // If no match is found but the target could be a partial match
    const possibleTableMatches = tables.filter(t => 
      t.toLowerCase().includes(normalizedTarget) || 
      normalizedTarget.includes(t.toLowerCase())
    );
    
    if (possibleTableMatches.length > 0) {
      return formatPromptSuccessResponse(
        `Could not find exact match for "${target}". Did you mean one of these tables?\n\n${possibleTableMatches.join('\n')}`
      );
    }
    
    // No match found
    return formatPromptErrorResponse(
      `Could not find a table, column, or database feature matching "${target}"`,
      "NOT_FOUND"
    );
    
  } catch (error) {
    return formatPromptErrorResponse(
      `Error explaining database: ${(error as Error).message}`,
      "EXPLANATION_ERROR"
    );
  }
}

/**
 * Helper function to make an educated guess about the purpose of a table
 * based on its name and columns
 */
function determineTablePurpose(tableName: string, columns: any[]): string {
  const lowerTableName = tableName.toLowerCase();
  const columnNames = columns.map(c => c.column_name.toLowerCase());
  
  // Check for common patterns
  if (lowerTableName.includes('user') || columnNames.includes('username') || columnNames.includes('email')) {
    return 'user information and profiles';
  }
  
  if (lowerTableName.includes('order') || lowerTableName.includes('purchase')) {
    return 'order or purchase transactions';
  }
  
  if (lowerTableName.includes('product') || lowerTableName.includes('item')) {
    return 'product or item information';
  }
  
  if (lowerTableName.includes('log') || columnNames.includes('timestamp')) {
    return 'event or activity logs';
  }
  
  if (columnNames.includes('created_at') && columnNames.includes('updated_at')) {
    return 'tracking timestamped data records';
  }
  
  // Default
  return 'data related to ' + tableName;
}

/**
 * Helper function to determine potential relationships based on column names
 */
function determineRelationships(tableName: string, columns: any[]): string {
  const potentialRelationships = [];
  
  // Look for _id columns which often indicate foreign keys
  const idColumns = columns.filter(c => 
    c.column_name.toLowerCase().endsWith('_id') && 
    !c.column_name.toLowerCase().startsWith(tableName.toLowerCase())
  );
  
  if (idColumns.length > 0) {
    idColumns.forEach(col => {
      const referencedTable = col.column_name.toLowerCase().replace('_id', '');
      potentialRelationships.push(`May have a relationship with the "${referencedTable}" table (via ${col.column_name})`);
    });
  }
  
  // Check if the table itself might be referenced by others
  if (columns.some(c => c.column_name.toLowerCase() === 'id')) {
    potentialRelationships.push(`May be referenced by other tables as "${tableName.toLowerCase()}_id"`);
  }
  
  return potentialRelationships.length > 0 
    ? potentialRelationships.join('\n')
    : 'No obvious relationships identified based on column names';
}

/**
 * Helper function to determine the purpose of a column based on naming patterns
 */
function determineColumnPurpose(columnName: string, dataType: string): string {
  const lowerColumnName = columnName.toLowerCase();
  
  if (lowerColumnName === 'id') {
    return 'Primary identifier for records in this table';
  }
  
  if (lowerColumnName.endsWith('_id')) {
    const referencedTable = lowerColumnName.replace('_id', '');
    return `Foreign key reference to the "${referencedTable}" table`;
  }
  
  if (lowerColumnName.includes('name')) {
    return 'Stores name information';
  }
  
  if (lowerColumnName.includes('email')) {
    return 'Stores email address information';
  }
  
  if (lowerColumnName.includes('password') || lowerColumnName.includes('hash')) {
    return 'Stores security credential information (likely hashed)';
  }
  
  if (lowerColumnName === 'created_at' || lowerColumnName === 'created_on') {
    return 'Timestamp for when the record was created';
  }
  
  if (lowerColumnName === 'updated_at' || lowerColumnName === 'modified_at') {
    return 'Timestamp for when the record was last updated';
  }
  
  if (lowerColumnName.includes('date') || lowerColumnName.includes('time')) {
    return 'Stores date or time information';
  }
  
  if (lowerColumnName.includes('price') || lowerColumnName.includes('cost') || lowerColumnName.includes('amount')) {
    return 'Stores monetary value information';
  }
  
  // Data type specific purposes
  if (dataType.includes('boolean')) {
    return 'Stores a true/false flag';
  }
  
  if (dataType.includes('json')) {
    return 'Stores structured JSON data';
  }
  
  if (dataType.includes('text') || dataType.includes('varchar') || dataType.includes('char')) {
    return 'Stores text information';
  }
  
  // Default
  return `Stores ${dataType} data`;
}

/**
 * Helper function to describe the overall database purpose based on tables
 */
function describeDatabasePurpose(tables: string[]): string {
  const tableNames = tables.map(t => t.toLowerCase());
  
  if (tableNames.some(t => t.includes('user')) && 
      tableNames.some(t => t.includes('order'))) {
    return 'appears to be an e-commerce or customer order management system';
  }
  
  if (tableNames.some(t => t.includes('patient')) || 
      tableNames.some(t => t.includes('medical'))) {
    return 'appears to be related to healthcare or medical record management';
  }
  
  if (tableNames.some(t => t.includes('student')) || 
      tableNames.some(t => t.includes('course'))) {
    return 'appears to be related to education or student management';
  }
  
  if (tableNames.some(t => t.includes('employee')) || 
      tableNames.some(t => t.includes('payroll'))) {
    return 'appears to be related to HR or employee management';
  }
  
  if (tableNames.some(t => t.includes('inventory')) || 
      tableNames.some(t => t.includes('stock'))) {
    return 'appears to be related to inventory or stock management';
  }
  
  // Default
  return 'contains multiple tables that store related information';
}