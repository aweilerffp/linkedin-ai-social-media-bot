import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { initializeDatabase, query } from '../config/database.js';
import { logger } from '../utils/logger.js';

dotenv.config();

async function runMigration(migrationFile) {
  try {
    // Initialize database connection
    await initializeDatabase();
    
    // Read migration file
    const migrationPath = path.join(process.cwd(), 'src/migrations', migrationFile);
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    // Execute migration
    await query(migrationSQL);
    
    logger.info(`Migration ${migrationFile} executed successfully`);
  } catch (error) {
    logger.error(`Migration ${migrationFile} failed:`, error);
    throw error;
  }
}

async function main() {
  const migrationFile = process.argv[2];
  
  if (!migrationFile) {
    console.log('Usage: node run-migration.js <migration-file>');
    process.exit(1);
  }
  
  try {
    await runMigration(migrationFile);
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

main();