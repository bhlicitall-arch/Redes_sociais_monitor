/**
 * Autenticação Multi-Tenant (JWT)
 *
 * Gerencia:
 * - Login/registro de usuários por tenant
 * - Geração e validação de tokens JWT
 * - Controle de acesso baseado em papel (admin, manager, analyst, viewer)
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb } from '../db';
import { generateId, logger } from '../utils';
import { TenantUser } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'platform-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = '24h';

export interface AuthPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: TenantUser['role'];
  tenantSlug: string;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  user?: Omit<TenantUser, 'passwordHash'>;
  error?: string;
}

// ============================================================
// Hash de Senha
// ============================================================

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

// ============================================================
// JWT
// ============================================================

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

// ============================================================
// Registro do Primeiro Usuário + Tenant
// ============================================================

export async function registerTenant(params: {
  companyName: string;
  slug: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  plan?: string;
}): Promise<AuthResult> {
  const db = getDb();

  // Verifica se slug já existe
  const existingSlug = db.prepare('SELECT id FROM tenants WHERE slug = ?').get(params.slug);
  if (existingSlug) {
    return { success: false, error: 'Este slug já está em uso' };
  }

  // Verifica email
  const existingEmail = db.prepare('SELECT id FROM tenant_users WHERE email = ?').get(params.adminEmail);
  if (existingEmail) {
    return { success: false, error: 'Este email já está cadastrado' };
  }

  // Cria tenant
  const tenantId = generateId();
  db.prepare(`
    INSERT INTO tenants (id, name, slug, plan, status)
    VALUES (?, ?, ?, ?, 'active')
  `).run(tenantId, params.companyName, params.slug, params.plan || 'trial');

  // Cria admin user
  const userId = generateId();
  const passwordHash = hashPassword(params.adminPassword);
  db.prepare(`
    INSERT INTO tenant_users (id, tenant_id, email, name, password_hash, role)
    VALUES (?, ?, ?, ?, ?, 'admin')
  `).run(userId, tenantId, params.adminEmail, params.adminName, passwordHash);

  const token = generateToken({
    userId,
    tenantId,
    email: params.adminEmail,
    role: 'admin',
    tenantSlug: params.slug,
  });

  logger.info({ tenantId, userId, company: params.companyName }, 'New tenant registered');

  return {
    success: true,
    token,
    user: ({
      id: userId,
      tenantId,
      email: params.adminEmail,
      name: params.adminName,
      role: 'admin',
      status: 'active',
      createdAt: new Date(),
    }) as Omit<TenantUser, 'passwordHash'>,
  };
}

// ============================================================
// Login
// ============================================================

export async function login(email: string, password: string): Promise<AuthResult> {
  const db = getDb();

  const user = db.prepare(`
    SELECT tu.*, t.slug as tenant_slug
    FROM tenant_users tu
    JOIN tenants t ON t.id = tu.tenant_id
    WHERE tu.email = ? AND tu.status = 'active'
  `).get(email) as (TenantUser & { tenant_slug: string }) | undefined;

  if (!user) {
    return { success: false, error: 'Email ou senha inválidos' };
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return { success: false, error: 'Email ou senha inválidos' };
  }

  // Atualiza last_login
  db.prepare('UPDATE tenant_users SET last_login = datetime("now") WHERE id = ?').run(user.id);

  const token = generateToken({
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
    tenantSlug: user.tenant_slug,
  });

  return {
    success: true,
    token,
    user: ({
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    }) as Omit<TenantUser, 'passwordHash'>,
  };
}

// ============================================================
// Convidar Usuário
// ============================================================

export async function inviteUser(params: {
  tenantId: string;
  email: string;
  name: string;
  role: TenantUser['role'];
  password: string;
}): Promise<AuthResult> {
  const db = getDb();

  const existing = db.prepare('SELECT id FROM tenant_users WHERE tenant_id = ? AND email = ?')
    .get(params.tenantId, params.email);

  if (existing) {
    return { success: false, error: 'Usuário já existe neste tenant' };
  }

  const userId = generateId();
  const passwordHash = hashPassword(params.password);

  db.prepare(`
    INSERT INTO tenant_users (id, tenant_id, email, name, password_hash, role, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
  `).run(userId, params.tenantId, params.email, params.name, passwordHash, params.role);

  logger.info({ tenantId: params.tenantId, userId }, 'User invited');

  return { success: true };
}

// ============================================================
// Projetos CRUD
// ============================================================

export function createProject(params: {
  tenantId: string;
  name: string;
  objective: string;
  keywords: string[];
  platforms: string[];
  config?: Record<string, unknown>;
}) {
  const db = getDb();
  const id = generateId();

  db.prepare(`
    INSERT INTO projects (id, tenant_id, name, objective, keywords, platforms, config)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, params.tenantId, params.name, params.objective,
    JSON.stringify(params.keywords), JSON.stringify(params.platforms),
    JSON.stringify(params.config || {})
  );

  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
}

export function listProjects(tenantId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM projects WHERE tenant_id = ? ORDER BY created_at DESC').all(tenantId);
}

export function getProject(projectId: string, tenantId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM projects WHERE id = ? AND tenant_id = ?').get(projectId, tenantId);
}

export function getTenantBySlug(slug: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM tenants WHERE slug = ?').get(slug);
}
