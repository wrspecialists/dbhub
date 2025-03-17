/**
 * Demo data loader for SQLite in-memory database
 * 
 * This module loads the sample employee database into the SQLite in-memory database
 * when the --demo flag is specified.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to sample data files - will be bundled with the package
const DEMO_DATA_DIR = path.join(__dirname, '..', 'resources', 'employee-sqlite');

/**
 * Load SQL file contents
 */
export function loadSqlFile(fileName: string): string {
  const filePath = path.join(DEMO_DATA_DIR, fileName);
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Get SQLite DSN for in-memory database
 */
export function getInMemorySqliteDSN(): string {
  return 'sqlite::memory:';
}

/**
 * Load SQL files sequentially
 */
export function getSqliteInMemorySetupSql(): string {
  // First, load the schema
  let sql = loadSqlFile('employee.sql');
  
  // Replace .read directives with the actual file contents
  // This is necessary because in-memory SQLite can't use .read
  const readRegex = /\.read\s+([a-zA-Z0-9_]+\.sql)/g;
  let match;
  
  while ((match = readRegex.exec(sql)) !== null) {
    const includePath = match[1];
    const includeContent = loadSqlFile(includePath);
    
    // Replace the .read line with the file contents
    sql = sql.replace(match[0], includeContent);
  }
  
  return sql;
}