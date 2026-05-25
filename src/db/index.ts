/**
 * Database — Camada de Persistencia
 *
 * SQLite via better-sqlite3 para MVP.
 * Suporta migrations para adicionar colunas sem quebrar schema existente.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils';

const DB_PATH = process.env.DATABASE_URL
  ? process.env.DATABASE_URL
  : path.join(__dirname, '..', '..', 'data', 'platform.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    logger.info({ path: DB_PATH }, 'Database initialized');
  }
  return db;
}

export function initializeDatabase(): void {
  const db = getDb();

  // Schema principal (CREATE TABLE IF NOT EXISTS)
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
      logo TEXT, primary_color TEXT DEFAULT '#3b82f6',
      plan TEXT NOT NULL DEFAULT 'trial' CHECK(plan IN ('trial','starter','professional','enterprise')),
      status TEXT NOT NULL DEFAULT 'trial' CHECK(status IN ('active','suspended','trial','cancelled')),
      settings TEXT DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tenant_users (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      email TEXT NOT NULL, name TEXT NOT NULL, password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'analyst' CHECK(role IN ('admin','manager','analyst','viewer')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','invited','disabled')),
      last_login TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(tenant_id, email)
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL, description TEXT, objective TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '[]', platforms TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','archived')),
      config TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_tasks (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('monitoring','report','analysis')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','assigned','in_progress','completed','failed','cancelled')),
      result TEXT, error TEXT, started_at TEXT, completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mention_records (
      id TEXT PRIMARY KEY, project_id TEXT, tenant_id TEXT,
      task_id TEXT, platform TEXT NOT NULL, author TEXT,
      content TEXT NOT NULL, url TEXT, language TEXT DEFAULT 'pt-BR',
      region TEXT, engagement TEXT, sentiment_label TEXT, sentiment_score REAL,
      risk_level TEXT, risk_score REAL,
      collected_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY, project_id TEXT, objective TEXT NOT NULL,
      content_markdown TEXT, content_pdf BLOB,
      analyses_count INTEGER DEFAULT 0, assessments_count INTEGER DEFAULT 0,
      mentions_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      plan TEXT NOT NULL, amount REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'BRL',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','overdue','cancelled')),
      period_start TEXT NOT NULL, period_end TEXT NOT NULL, paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tenant_users_email ON tenant_users(email);
    CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_mention_records_project ON mention_records(project_id);
    CREATE INDEX IF NOT EXISTS idx_mention_records_collected ON mention_records(collected_at);
    CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);
    CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
  `);

  // Migrations: colunas que podem nao existir em schemas antigos
  const migrations: Array<{ column: string; table: string; def: string }> = [
    { column: 'orchestrator_task_id', table: 'project_tasks', def: 'TEXT' },
  ];

  for (const m of migrations) {
    try {
      const colExists = db.prepare(
        `SELECT COUNT(*) as cnt FROM pragma_table_info(?) WHERE name = ?`
      ).get(m.table, m.column) as any;
      if (!colExists || colExists.cnt === 0) {
        db.exec(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.def}`);
        logger.info({ table: m.table, column: m.column }, 'Migration applied');
      }
    } catch (e) {
      logger.warn({ table: m.table, column: m.column, error: String(e) }, 'Migration failed (non-critical)');
    }
  }

  logger.info('Database schema initialized');
}
