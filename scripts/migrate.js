import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, readdirSync } from 'fs';
import { initializeDatabase, query } from '../backend/src/config/database.js';
import { logger } from '../backend/src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATIONS_DIR = join(__dirname, '../backend/src/migrations');

async function runMigrations() {
  try {
    await initializeDatabase();
    
    // Create migrations table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Get applied migrations
    const appliedResult = await query('SELECT version FROM schema_migrations ORDER BY version');
    const appliedMigrations = appliedResult.rows.map(row => row.version);

    // Get all migration files
    const migrationFiles = readdirSync(MIGRATIONS_DIR)
      .filter(file => file.endsWith('.sql'))
      .sort();

    logger.info(`Found ${migrationFiles.length} migration files`);
    logger.info(`Applied migrations: ${appliedMigrations.length}`);

    for (const file of migrationFiles) {
      const version = file.replace('.sql', '');
      
      if (appliedMigrations.includes(version)) {
        logger.info(`Skipping already applied migration: ${version}`);
        continue;
      }

      logger.info(`Applying migration: ${version}`);
      
      const migrationPath = join(MIGRATIONS_DIR, file);
      const migrationSQL = readFileSync(migrationPath, 'utf8');
      
      try {
        await query('BEGIN');
        await query(migrationSQL);
        await query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        await query('COMMIT');
        
        logger.info(`Successfully applied migration: ${version}`);
      } catch (error) {
        await query('ROLLBACK');
        logger.error(`Failed to apply migration ${version}:`, error);
        throw error;
      }
    }

    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runMigrations();