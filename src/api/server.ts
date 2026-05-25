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
import { connectorManager } from '../connectors/connector-manager';
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
  // HISTORICO — Mencoes e Tasks persistidas
  // ============================================================

  app.get('/api/projects/:id/history', authMw, (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthPayload;
      const projectId = req.params.id as string;
      const db = getDb();

      const tasks = db.prepare(
        'SELECT * FROM project_tasks WHERE project_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 50'
      ).all(projectId, user.tenantId);

      const mentions = db.prepare(
        'SELECT * FROM mention_records WHERE project_id = ? AND tenant_id = ? ORDER BY collected_at DESC LIMIT 100'
      ).all(projectId, user.tenantId);

      const reports = db.prepare(
        'SELECT id, objective, analyses_count, mentions_count, created_at FROM reports ORDER BY created_at DESC LIMIT 20'
      ).all();

      res.json({ tasks, mentions, reports, taskCount: tasks.length, mentionCount: mentions.length });
    } catch { res.status(500).json({ error: 'Failed to load history' }); }
  });

  app.get('/api/projects/:id/mentions', authMw, (req: Request, res: Response) => {
    try {
      const user = (req as any).user as AuthPayload;
      const projectId = req.params.id as string;
      const db = getDb();
      const mentions = db.prepare(
        'SELECT * FROM mention_records WHERE project_id = ? AND tenant_id = ? ORDER BY collected_at DESC LIMIT 200'
      ).all(projectId, user.tenantId);
      // Parse engagement JSON
      const parsed = (mentions as any[]).map(m => ({
        ...m,
        engagement: m.engagement ? JSON.parse(m.engagement) : null,
      }));
      res.json({ mentions: parsed, count: parsed.length });
    } catch { res.status(500).json({ error: 'Failed to load mentions' }); }
  });

  // ============================================================
  // RELATORIOS + PDF
  // ============================================================

  app.post('/api/reports/generate', async (req: Request, res: Response) => {
    try {
      const { objective, projectId } = req.body;
      if (!objective) return res.status(400).json({ error: 'Objective is required' });

      // Injeta projectId no metadata para o ReportGen buscar menções do banco
      const task = await orchestrator.submitObjective('Gerar relatorio: ' + objective, 'high');

      // Aguarda conclusao
      await new Promise(r => setTimeout(r, 3000));

      const completed = orchestrator.getTaskStatus(task.id);
      const reportSubtask = completed?.subtasks.find(st => st.assignedAgent === 'report_gen');
      const reportData = reportSubtask?.result?.data as any;

      res.json({
        taskId: task.id,
        status: completed?.status,
        report: reportData?.content || null,
        metrics: reportData?.metrics || null,
        reportId: reportData?.reportId || null,
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Lista relatorios gerados
  app.get('/api/reports/list', (req: Request, res: Response) => {
    try {
      const db = getDb();
      const reports = db.prepare(
        'SELECT id, objective, analyses_count, mentions_count, created_at FROM reports ORDER BY created_at DESC LIMIT 50'
      ).all();
      res.json({ reports, count: reports.length });
    } catch { res.json({ reports: [], count: 0 }); }
  });

  // Gera PDF de um relatorio
  app.get('/api/reports/:id/pdf', (req: Request, res: Response) => {
    try {
      const db = getDb();
      const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id) as any;
      if (!report) return res.status(404).json({ error: 'Report not found' });

      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ size: 'A4', margin: 50 });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=relatorio-' + report.id.slice(0, 8) + '.pdf');
      doc.pipe(res);

      // Cabeçalho
      doc.fontSize(18).font('Helvetica-Bold').text('Midia Monitor — By Techlicense', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text('Relatorio Analitico de Monitoramento', { align: 'center' });
      doc.moveDown();
      doc.fontSize(9).text('Objetivo: ' + report.objective, { align: 'center' });
      doc.text('Gerado em: ' + report.created_at, { align: 'center' });
      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown();

      // Conteudo do relatorio (Markdown simplificado para PDF)
      const content = report.content_markdown || '';
      const lines = content.split('\n');

      for (const line of lines) {
        if (line.startsWith('# ')) {
          doc.fontSize(14).font('Helvetica-Bold').text(line.replace(/^# /, ''), { underline: true });
          doc.moveDown(0.5);
        } else if (line.startsWith('## ')) {
          doc.fontSize(11).font('Helvetica-Bold').text(line.replace(/^## /, ''));
          doc.moveDown(0.3);
        } else if (line.startsWith('|')) {
          doc.fontSize(7).font('Helvetica').text(line.replace(/\|/g, '  '), { indent: 10 });
        } else if (line.startsWith('> ')) {
          doc.fontSize(8).font('Helvetica-Oblique').text(line.replace(/^> /, ''), { indent: 20 });
          doc.moveDown(0.2);
        } else if (line.trim() === '---') {
          doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
          doc.moveDown();
        } else if (line.trim()) {
          doc.fontSize(8).font('Helvetica').text(line);
        }
      }

      // Footer
      doc.moveDown(2);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(7).font('Helvetica').text('Midia Monitor — By Techlicense | Plataforma Agentic de Monitoramento Superior', { align: 'center' });

      doc.end();
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  });

  // Gera PDF sob demanda (sem relatorio salvo)
  app.post('/api/reports/export-pdf', async (req: Request, res: Response) => {
    try {
      const { objective } = req.body;
      if (!objective) return res.status(400).json({ error: 'Objective is required' });

      // Gera relatorio primeiro
      const task = await orchestrator.submitObjective('Gerar relatorio: ' + objective, 'high');
      await new Promise(r => setTimeout(r, 3000));

      const completed = orchestrator.getTaskStatus(task.id);
      const reportSubtask = completed?.subtasks.find(st => st.assignedAgent === 'report_gen');
      const reportData = reportSubtask?.result?.data as any;
      const content = reportData?.content || '';

      // Gera PDF
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ size: 'A4', margin: 50 });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=relatorio-midia-monitor.pdf');
      doc.pipe(res);

      doc.fontSize(18).font('Helvetica-Bold').text('Midia Monitor — By Techlicense', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text('Relatorio Analitico de Monitoramento', { align: 'center' });
      doc.moveDown();
      doc.fontSize(9).text('Objetivo: ' + objective, { align: 'center' });
      doc.text('Gerado em: ' + new Date().toLocaleString('pt-BR'), { align: 'center' });
      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown();

      for (const line of content.split('\n')) {
        if (line.startsWith('# ')) {
          doc.fontSize(14).font('Helvetica-Bold').text(line.replace(/^# /, ''), { underline: true });
          doc.moveDown(0.5);
        } else if (line.startsWith('## ')) {
          doc.fontSize(11).font('Helvetica-Bold').text(line.replace(/^## /, ''));
          doc.moveDown(0.3);
        } else if (line.startsWith('|')) {
          doc.fontSize(7).font('Helvetica').text(line.replace(/\|/g, '  '), { indent: 10 });
        } else if (line.startsWith('> ')) {
          doc.fontSize(8).font('Helvetica-Oblique').text(line.replace(/^> /, ''), { indent: 20 });
          doc.moveDown(0.2);
        } else if (line.trim() === '---') {
          doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
          doc.moveDown();
        } else if (line.trim()) {
          doc.fontSize(8).font('Helvetica').text(line);
        }
      }

      doc.moveDown(2);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(7).font('Helvetica').text('Midia Monitor — By Techlicense', { align: 'center' });

      doc.end();
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
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

      // Passa projectId como contexto para persistencia
      const task = await orchestrator.submitObjective(
        'Monitorar: ' + project.objective,
        req.body.priority || 'medium'
      );

      const db = getDb();
      const dbTaskId = generateId();
      const createdAt = new Date().toISOString();

      // Persiste task do projeto associada ao orchestrator task
      db.prepare(`
        INSERT INTO project_tasks (id, project_id, tenant_id, orchestrator_task_id, type, status, started_at)
        VALUES (?, ?, ?, ?, 'monitoring', ?, ?)
      `).run(dbTaskId, project.id, user.tenantId, task.id, task.status, createdAt);

      // Atualiza menções no banco com o project_id correto
      if (task.subtasks.some(st => st.assignedAgent === 'collector' && st.status === 'completed')) {
        db.prepare(
          "UPDATE mention_records SET project_id = ?, tenant_id = ? WHERE project_id = '' OR project_id IS NULL"
        ).run(project.id, user.tenantId);
      }

      res.json({
        taskId: task.id,
        dbTaskId,
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
  // CONNECTORS — API Keys e Status
  // ============================================================

  app.get('/api/connectors/status', (_req: Request, res: Response) => {
    try {
      const status = connectorManager.getStatus();
      res.json({ connectors: status });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.post('/api/connectors/configure', authMw, (req: Request, res: Response) => {
    try {
      const { platform, credentials } = req.body;
      if (!platform || !credentials) {
        return res.status(400).json({ error: 'Platform e credentials sao obrigatorios' });
      }
      connectorManager.configure(platform, credentials);
      connectorManager.connect(platform);
      res.json({ message: 'Conector configurado', platform, connected: true });
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
