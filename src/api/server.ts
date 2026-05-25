/**
 * Server Express -- API REST Multi-Tenant
 *
 * Endpoints comerciais:
 *  POST   /api/auth/register     - Criar conta (tenant + admin)
 *  POST   /api/auth/login        - Login
 *  GET    /api/auth/me           - Dados do usuario logado
 *  POST   /api/projects          - Criar projeto
 *  GET    /api/projects          - Listar projetos
 *  GET    /api/projects/:id      - Detalhes do projeto
 *  POST   /api/projects/:id/monitor - Monitorar projeto
 *  GET    /api/health            - Health check
 *  GET    /api/dashboard/summary - Metricas do sistema
 *  POST   /api/reports/generate  - Gerar relatorio
 *  POST   /api/anonymize         - Anonimizar texto (LGPD)
 *  GET    /api/audit/integrity   - Verificar auditoria
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import http from 'http';
import path from 'path';
import { logger, loadConfig, generateId } from '../utils';
import { AgentType } from '../types';
import { Orchestrator } from '../core/orchestrator';
import { AgentManager } from '../core/agent-manager';
import { CollectorAgent } from '../agents/collector';
import { AnalystAgent } from '../agents/analyst';
import { RiskDetectorAgent } from '../agents/risk-detector';
import { ReportGenAgent } from '../agents/report-gen';
import { CrisisBotAgent } from '../agents/crisis-bot';
import { mcpBridge } from '../mcp';
import { securityManager } from '../security';
import { memoryManager } from '../memory';
import { SkillRegistry } from '../core/skill-registry';
import { initializeSkills } from '../skills';
import { initializeDatabase, getDb } from '../db';
import {
  registerTenant, login, verifyToken,
  createProject, listProjects, getProject,
  AuthPayload,
} from '../auth';

// ============================================================
// Globals
// ============================================================

let orchestrator: Orchestrator;
let agentManager: AgentManager;
let crisisBot: CrisisBotAgent;

async function initializePlatform(): Promise<void> {
  initializeDatabase();

  const skillRegistry = new SkillRegistry();
  agentManager = new AgentManager();
  const auditLogger = securityManager.auditLogger;
  orchestrator = new Orchestrator(agentManager, auditLogger);

  initializeSkills(skillRegistry);

  agentManager.registerAgent(new CollectorAgent());
  agentManager.registerAgent(new AnalystAgent());
  agentManager.registerAgent(new RiskDetectorAgent());
  agentManager.registerAgent(new ReportGenAgent());
  crisisBot = new CrisisBotAgent();
  agentManager.registerAgent(crisisBot);

  await mcpBridge.connectPlatform('twitter');
  await mcpBridge.connectPlatform('instagram');
  await mcpBridge.connectPlatform('news_portal');

  logger.info('Platform initialized');
}

// ============================================================
// Auth Middleware
// ============================================================

function authMw(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token nao fornecido' });
    return;
  }
  const payload = verifyToken(header.slice(7));
  if (!payload) {
    res.status(401).json({ error: 'Token invalido ou expirado' });
    return;
  }
  (req as any).user = payload;
  next();
}

// ============================================================
// Express App
// ============================================================

export function createApp(): Express {
  const app: Express = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // === Health ===
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
  });

  // ============================================================
  // AUTH
  // ============================================================

  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { companyName, slug, adminName, adminEmail, adminPassword, plan } = req.body;
      if (!companyName || !slug || !adminName || !adminEmail || !adminPassword) {
        return res.status(400).json({ error: 'Todos os campos sao obrigatorios' });
      }
      if (adminPassword.length < 6) {
        return res.status(400).json({ error: 'Senha deve ter no minimo 6 caracteres' });
      }
      const result = await registerTenant({ companyName, slug, adminName, adminEmail, adminPassword, plan });
      if (!result.success) return res.status(400).json({ error: result.error });

      const defaultProject = createProject({
        tenantId: result.user!.tenantId,
        name: 'Monitoramento Inicial',
        objective: 'Monitorar reputacao da empresa',
        keywords: [companyName],
        platforms: ['twitter', 'instagram', 'facebook', 'news_portal'],
      });

      res.status(201).json({
        message: 'Conta criada com sucesso!',
        token: result.token,
        user: result.user,
        project: defaultProject,
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatorios' });
      const result = await login(email, password);
      if (!result.success) return res.status(401).json({ error: result.error });
      res.json({ token: result.token, user: result.user });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get('/api/auth/me', authMw, (req: Request, res: Response) => {
    const user = (req as any).user as AuthPayload;
    const db = getDb();
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(user.tenantId);
    const projects = listProjects(user.tenantId);
    res.json({ user, tenant, projects });
  });

  // ============================================================
  // PROJECTS
  // ============================================================

  app.post('/api/projects', authMw, (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthPayload;
      const { name, objective, keywords, platforms } = req.body;
      if (!name || !objective) return res.status(400).json({ error: 'Nome e objetivo obrigatorios' });
      const project = createProject({
        tenantId: user.tenantId, name, objective,
        keywords: keywords || [],
        platforms: platforms || ['twitter', 'instagram', 'facebook', 'news_portal'],
      });
      res.status(201).json(project);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get('/api/projects', authMw, (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthPayload;
      res.json({ projects: listProjects(user.tenantId) });
    } catch { res.status(500).json({ error: 'Failed to list projects' }); }
  });

  app.get('/api/projects/:id', authMw, (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthPayload;
      const projectId = req.params.id as string;
      const project = getProject(projectId, user.tenantId);
      if (!project) return res.status(404).json({ error: 'Projeto nao encontrado' });
      res.json(project);
    } catch { res.status(500).json({ error: 'Failed to get project' }); }
  });

  // ============================================================
  // MONITOR POR PROJETO
  // ============================================================

  app.post('/api/projects/:id/monitor', authMw, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthPayload;
      const projectId = req.params.id as string;
      const project = getProject(projectId, user.tenantId) as any;
      if (!project) return res.status(404).json({ error: 'Projeto nao encontrado' });

      const task = await orchestrator.submitObjective(
        'Monitorar: ' + project.objective,
        req.body.priority || 'medium'
      );

      const db = getDb();
      db.prepare(
        'INSERT INTO project_tasks (id, project_id, tenant_id, type, status) VALUES (?, ?, ?, ?, ?)'
      ).run(generateId(), project.id, user.tenantId, 'monitoring', task.status);

      res.json({
        taskId: task.id,
        projectId: project.id,
        status: task.status,
        subtasks: task.subtasks.map((st: any) => ({
          agent: st.assignedAgent,
          status: st.status,
          result: st.result?.summary,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // ============================================================
  // DASHBOARD / SISTEMA
  // ============================================================

  app.get('/api/dashboard/summary', async (_req: Request, res: Response) => {
    try {
      const mcpHealth = await mcpBridge.healthCheck();
      res.json({
        activeTasks: orchestrator.getActiveTasks().length,
        mcpConnections: Object.values(mcpHealth).filter(s => s === 'connected').length,
        mcpTotal: Object.keys(mcpHealth).length,
        auditIntegrity: securityManager.verifyAuditIntegrity().valid,
        timestamp: new Date().toISOString(),
      });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.get('/api/dashboard/mcp-status', async (_req: Request, res: Response) => {
    try {
      const health = await mcpBridge.healthCheck();
      res.json({
        connections: Object.entries(health).map(([name, status]) => ({ name, status, connected: status === 'connected' })),
      });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.post('/api/monitor/start', async (req: Request, res: Response) => {
    try {
      const { objective, priority } = req.body;
      if (!objective) return res.status(400).json({ error: 'Objective is required' });
      const task = await orchestrator.submitObjective(objective, priority || 'medium');
      res.json({
        taskId: task.id, objective: task.objective, status: task.status,
        subtasks: task.subtasks.map(st => ({
          id: st.id, agent: st.assignedAgent,
          objective: (st.objective || '').slice(0, 80),
          status: st.status, result: st.result?.summary,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post('/api/reports/generate', async (req: Request, res: Response) => {
    try {
      const { objective } = req.body;
      if (!objective) return res.status(400).json({ error: 'Objective is required' });
      const task = await orchestrator.submitObjective('Gerar relatorio: ' + objective, 'high');
      await new Promise(r => setTimeout(r, 3000));
      const completed = orchestrator.getTaskStatus(task.id);
      const reportSubtask = completed?.subtasks.find(st => st.assignedAgent === 'report_gen');
      res.json({ taskId: task.id, status: completed?.status, report: reportSubtask?.result?.data || null });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post('/api/anonymize', (req: Request, res: Response) => {
    try {
      const { text, level } = req.body;
      if (!text) return res.status(400).json({ error: 'Text is required' });
      res.json({ original: text, anonymized: securityManager.anonymizer.anonymize(text, level || 'moderate') });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.get('/api/audit/integrity', (_req: Request, res: Response) => {
    try { res.json(securityManager.verifyAuditIntegrity()); }
    catch { res.status(500).json({ error: 'Failed' }); }
  });

  // === Serve Frontend ===
  if (process.env.NODE_ENV === 'production') {
    const possiblePaths = [
      path.join(__dirname, '..', 'frontend', 'dist'),
      path.join(__dirname, '..', '..', 'frontend', 'dist'),
      path.join(process.cwd(), 'frontend', 'dist'),
    ];
    let frontendDist = '';
    for (const p of possiblePaths) {
      try {
        if (require('fs').existsSync(path.join(p, 'index.html'))) {
          frontendDist = p;
          break;
        }
      } catch { /* next */ }
    }
    if (frontendDist) {
      logger.info({ frontendDist }, 'Serving frontend');
      app.use(express.static(frontendDist));
      app.use((req: Request, res: Response) => {
        if (!req.path.startsWith('/api')) res.sendFile(path.join(frontendDist, 'index.html'));
        else res.status(404).json({ error: 'API route not found' });
      });
    } else {
      logger.warn('Frontend not found - API only');
    }
  }

  return app;
}

// ============================================================
// Start
// ============================================================

export async function startServer(port?: number): Promise<http.Server> {
  const config = loadConfig();
  const serverPort = port || config.port || 3000;

  await initializePlatform();

  const app = createApp();
  const server = http.createServer(app);

  return new Promise((resolve) => {
    server.listen(serverPort, () => {
      logger.info({ port: serverPort }, 'Platform API server running');
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  });
}
