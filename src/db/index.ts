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
    db.pragma('foreign_keys = OFF'); // Validacao por codigo, nao por schema
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
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
      name TEXT NOT NULL, description TEXT, objective TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '[]', platforms TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','archived')),
      config TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_tasks (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
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
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
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
  // Migrations
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

  // Migration 2: recria tabelas com schema sem FK (para bancos antigos)
  try {
    // Verifica se a tabela projects ainda tem FK (schema antigo)
    const fkCol = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'`).get() as any;
    if (fkCol && fkCol.sql && fkCol.sql.includes('REFERENCES')) {
      logger.info('Migrating old schema: recreating tables without FK constraints');
      db.exec("PRAGMA foreign_keys=OFF");
      db.exec(`
        CREATE TABLE projects_new (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, objective TEXT NOT NULL, keywords TEXT NOT NULL DEFAULT '[]', platforms TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'active', config TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
        INSERT INTO projects_new SELECT id, tenant_id, name, description, objective, keywords, platforms, status, config, created_at, updated_at FROM projects;
        DROP TABLE projects;
        ALTER TABLE projects_new RENAME TO projects;

        CREATE TABLE project_tasks_new (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, tenant_id TEXT NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', result TEXT, error TEXT, started_at TEXT, completed_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
        INSERT INTO project_tasks_new SELECT id, project_id, tenant_id, type, status, result, error, started_at, completed_at, created_at FROM project_tasks;
        DROP TABLE project_tasks;
        ALTER TABLE project_tasks_new RENAME TO project_tasks;

        CREATE TABLE mention_records_new (id TEXT PRIMARY KEY, project_id TEXT, tenant_id TEXT, task_id TEXT, platform TEXT NOT NULL, author TEXT, content TEXT NOT NULL, url TEXT, language TEXT DEFAULT 'pt-BR', region TEXT, engagement TEXT, sentiment_label TEXT, sentiment_score REAL, risk_level TEXT, risk_score REAL, collected_at TEXT NOT NULL DEFAULT (datetime('now')), created_at TEXT NOT NULL DEFAULT (datetime('now')));
        INSERT INTO mention_records_new SELECT id, project_id, tenant_id, task_id, platform, author, content, url, language, region, engagement, sentiment_label, sentiment_score, risk_level, risk_score, collected_at, created_at FROM mention_records;
        DROP TABLE mention_records;
        ALTER TABLE mention_records_new RENAME TO mention_records;
      `);
      logger.info('Schema migration complete - all FK constraints removed');
    }
  } catch (e) {
    logger.warn({ error: String(e) }, 'Schema migration skipped (tables already migrated)');
  }

  logger.info('Database schema initialized');
}
