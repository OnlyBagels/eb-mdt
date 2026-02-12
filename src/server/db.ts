// Database initialization and utility functions
// Uses SQLite for MDT-specific tables, oxmysql for shared tables (players, player_vehicles)
import { DatabaseSync } from 'node:sqlite';
import { DebugLog } from '@common/index';
import { oxmysql as MySQL } from '@communityox/oxmysql';
import { cache } from '@communityox/ox_lib/server';

// Re-export MySQL for shared database operations (players, player_vehicles, etc.)
export { MySQL };

// ==========================================
// SQLite Database Setup
// ==========================================

const resourcePath = GetResourcePath(cache.resource);
const sqlite = new DatabaseSync(`${resourcePath}/db.sqlite`);

// List of required tables that must exist
const requiredTables = [
  'mdt_reports',
  'mdt_report_officers',
  'mdt_report_involved',
  'mdt_report_charges',
  'mdt_report_evidence',
  'mdt_vehicle_flags',
  'mdt_weapon_registry',
  'mdt_announcements',
  'mdt_citizen_gangs',
  'mdt_gang_tags',
  'mdt_profile_notes',
  'mdt_profile_mugshots',
  'mdt_warrants',
  'mdt_dispatch_calls',
  'mdt_dispatch_units',
  'mdt_dispatch_history',
];

// Check if tables exist and initialize if needed
function initSQLite(): void {
  // Check which tables are missing
  const existingTables = sqlite.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'mdt_%'`
  ).all() as { name: string }[];

  const existingTableNames = new Set(existingTables.map(t => t.name));
  const missingTables = requiredTables.filter(t => !existingTableNames.has(t));

  if (missingTables.length > 0) {
    console.log(`^3[MDT] Missing tables detected: ${missingTables.join(', ')}^0`);
    console.log('^2[MDT] Running schema to create missing tables...^0');

    const schemaFile = LoadResourceFile(cache.resource, 'sql/schema.sql');
    if (schemaFile) {
      // Schema uses CREATE TABLE IF NOT EXISTS, so it's safe to run even if some tables exist
      sqlite.exec(schemaFile);
      console.log('^2[MDT] SQLite schema updated successfully^0');
    } else {
      console.error('^1[MDT] Failed to load sql/schema.sql^0');
    }
  }

  // Configure SQLite for better performance
  sqlite.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA journal_size_limit = 67108864;
    PRAGMA mmap_size = 134217728;
    PRAGMA cache_size = 2000;
    PRAGMA foreign_keys = ON;
  `);

  console.log('^2[MDT] SQLite database ready^0');
}

// Initialize immediately on module load
initSQLite();

// ==========================================
// SQLite Database Wrapper Class
// ==========================================

class SQLiteDatabase {
  // Execute a query that returns multiple rows
  query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    try {
      const stmt = sqlite.prepare(sql);
      return stmt.all(...params) as T[];
    } catch (error) {
      console.error('^1[MDT SQLite] Query error:^0', error);
      console.error('^1[MDT SQLite] SQL:^0', sql);
      console.error('^1[MDT SQLite] Params:^0', params);
      return [];
    }
  }

  // Execute a query that returns a single row
  single<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | null {
    try {
      const stmt = sqlite.prepare(sql);
      return stmt.get(...params) as T | null;
    } catch (error) {
      console.error('^1[MDT SQLite] Single query error:^0', error);
      console.error('^1[MDT SQLite] SQL:^0', sql);
      return null;
    }
  }

  // Execute an INSERT and return the last inserted row ID
  insert(sql: string, params: unknown[] = []): number {
    try {
      const stmt = sqlite.prepare(sql);
      const result = stmt.run(...params);
      return Number(result.lastInsertRowid);
    } catch (error) {
      console.error('^1[MDT SQLite] Insert error:^0', error);
      console.error('^1[MDT SQLite] SQL:^0', sql);
      return 0;
    }
  }

  // Execute an UPDATE/DELETE and return affected rows count
  update(sql: string, params: unknown[] = []): number {
    try {
      const stmt = sqlite.prepare(sql);
      const result = stmt.run(...params);
      return result.changes;
    } catch (error) {
      console.error('^1[MDT SQLite] Update error:^0', error);
      console.error('^1[MDT SQLite] SQL:^0', sql);
      return 0;
    }
  }

  // Execute raw SQL (for schema changes, etc.)
  exec(sql: string): void {
    try {
      sqlite.exec(sql);
    } catch (error) {
      console.error('^1[MDT SQLite] Exec error:^0', error);
    }
  }

  // Prepare a statement for repeated use
  prepare(sql: string) {
    return sqlite.prepare(sql);
  }
}

// Export SQLite database instance for MDT-specific operations
export const SQLite = new SQLiteDatabase();

// ==========================================
// Helper Functions
// ==========================================

// Helper function for safe JSON parsing
export function safeJsonParse<T>(jsonString: string | null | undefined, defaultValue: T): T {
  if (!jsonString) return defaultValue;
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return defaultValue;
  }
}

// Helper function to extract value from NUI callback data
// NUI sends data as objects like {searchQuery: "..."} or {reportId: 2}
// This function extracts the value whether it's passed directly or as an object property
export function extractParam<T>(data: unknown, key: string): T | undefined {
  if (data === null || data === undefined) return undefined;
  if (typeof data === 'object') {
    return (data as Record<string, unknown>)[key] as T;
  }
  return data as T;
}

// Helper function to get formatted timestamp for SQLite
export function getFormattedTimestamp(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

// Helper function to generate report number
export function generateReportNumber(): string {
  const date = new Date();
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

  // Get count for today from SQLite
  const countResult = SQLite.single<{ count: number }>(
    "SELECT COUNT(*) as count FROM mdt_reports WHERE report_number LIKE ?",
    [`${dateStr}-%`]
  );

  const count = (countResult?.count || 0) + 1;
  return `${dateStr}-${String(count).padStart(4, '0')}`;
}

// Convert SQLite boolean (0/1) to JavaScript boolean
export function sqliteBool(value: unknown): boolean {
  return value === 1 || value === true || value === '1';
}

// Convert JavaScript boolean to SQLite integer (0/1)
export function boolToSqlite(value: boolean): number {
  return value ? 1 : 0;
}
