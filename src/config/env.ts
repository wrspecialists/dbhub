import dotenv from "dotenv";
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { parseArgs } from 'node:util';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
export function parseCommandLineArgs() {
  const { values } = parseArgs({
    options: {
      dsn: { type: 'string' },
      transport: { type: 'string' }
    }
  });
  
  return values;
}

/**
 * Load environment files from various locations
 * Returns the name of the file that was loaded, or null if none was found
 */
export function loadEnvFiles(): string | null {
  // Determine if we're in development or production mode
  const isDevelopment = process.env.NODE_ENV === 'development' || process.argv[1]?.includes('tsx');

  // Select environment file names based on environment
  const envFileNames = isDevelopment 
    ? ['.env.local', '.env'] // In development, try .env.local first, then .env
    : ['.env']; // In production, only look for .env

  // Build paths to check for environment files
  const envPaths = [];
  for (const fileName of envFileNames) {
    envPaths.push(
      fileName, // Current working directory
      path.join(__dirname, '..', '..', fileName), // Two levels up (src/config -> src -> root)
      path.join(process.cwd(), fileName) // Explicit current working directory
    );
  }

  // Try to load the first env file found from the prioritized locations
  for (const envPath of envPaths) {
    console.error(`Checking for env file: ${envPath}`);
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      // Return the name of the file that was loaded
      return path.basename(envPath);
    }
  }
  
  return null;
}

/**
 * Resolve DSN from command line args, environment variables, or .env files
 * Returns the DSN and its source, or null if not found
 */
export function resolveDSN(): { dsn: string; source: string } | null {
  // Get command line arguments
  const args = parseCommandLineArgs();
  
  // 1. Check command line arguments first (highest priority)
  if (args.dsn) {
    return { dsn: args.dsn, source: 'command line argument' };
  }
  
  // 2. Check environment variables before loading .env
  if (process.env.DSN) {
    return { dsn: process.env.DSN, source: 'environment variable' };
  }
  
  // 3. Try loading from .env files
  const loadedEnvFile = loadEnvFiles();
  if (loadedEnvFile && process.env.DSN) {
    return { dsn: process.env.DSN, source: `${loadedEnvFile} file` };
  }
  
  return null;
}

/**
 * Resolve transport type from command line args or environment variables
 * Returns 'stdio' or 'sse', with 'stdio' as the default
 */
export function resolveTransport(): { type: 'stdio' | 'sse'; source: string } {
  // Get command line arguments
  const args = parseCommandLineArgs();
  
  // 1. Check command line arguments first (highest priority)
  if (args.transport) {
    const type = args.transport === 'sse' ? 'sse' : 'stdio';
    return { type, source: 'command line argument' };
  }
  
  // 2. Check environment variables
  if (process.env.TRANSPORT) {
    const type = process.env.TRANSPORT === 'sse' ? 'sse' : 'stdio';
    return { type, source: 'environment variable' };
  }
  
  // 3. Default to stdio
  return { type: 'stdio', source: 'default' };
}