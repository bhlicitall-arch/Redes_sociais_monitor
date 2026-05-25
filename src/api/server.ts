/**
 * Server Express + WebSocket -- API REST da Plataforma
 *
 * Fornece endpoints para:
 * - Dashboard: metricas em tempo real, summaries
 * - Monitoramento: mencoes, analises, risco
 * - Relatorios: gerar e consultar relatorios
 * - Alertas: listar e gerenciar alertas ativos
 * - Configuracao: status do sistema, health check
 *
 * WebSocket: streaming de dados em tempo real para o frontend.
 */

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import http from 'http';
import path from 'path';
import { logger, loadConfig } from '../utils';
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

// ============================================================
// Inicializacao da Plataforma
// ============================================================

let orchestrator: Orchestrator;
let agentManager: AgentManager;
let crisisBot: CrisisBotAgent;

async function initializePlatform(): Promise<void> {
  const skillRegistry = new SkillRegistry();
  agentManager = new AgentManager();
  const auditLogger = securityManager.auditLogger;
  orchestrator = new Orchestrator(agentManager, auditLogger);

  initializeSkills(skillRegistry);

  const collector = new CollectorAgent();
  const analyst = new AnalystAgent();
  const riskDetector = new RiskDetectorAgent();
  const reportGen = new ReportGenAgent();
  crisisBot = new CrisisBotAgent();

  agentManager.registerAgent(collector);
  agentManager.registerAgent(analyst);
  agentManager.registerAgent(riskDetector);
  agentManager.registerAgent(reportGen);
  agentManager.registerAgent(crisisBot);

  await mcpBridge.connectPlatform('twitter');
  await mcpBridge.connectPlatform('instagram');
  await mcpBridge.connectPlatform('news_portal');

  logger.info('Platform initialized successfully');
}

// ============================================================
// Express Server
// ============================================================

export function createApp(): Express {
  const app: Express = express();

  // Middleware
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health Check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  });

  // ============================================================
  // Dashboard
  // ============================================================

  app.get('/api/dashboard/summary', async (_req: Request, res: Response) => {
    try {
      const activeTasks = orchestrator.getActiveTasks();
      const mcpHealth = await mcpBridge.healthCheck();
      const auditIntegrity = securityManager.verifyAuditIntegrity();

      res.json({
        activeTasks: activeTasks.length,
        mcpConnections: Object.values(mcpHealth).filter((s) => s === 'connected').length,
        mcpTotal: Object.keys(mcpHealth).length,
        auditIntegrity: auditIntegrity.valid,
        memoryEntries: memoryManager.vector.getAll().length,
        crisisRecords: memoryManager.relational.searchCrisesByKeyword('').length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch dashboard summary' });
    }
  });

  app.get('/api/dashboard/mcp-status', async (_req: Request, res: Response) => {
    try {
      const health = await mcpBridge.healthCheck();
      res.json({
        connections: Object.entries(health).map(([name, status]) => ({
          name,
          status,
          connected: status === 'connected',
        })),
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch MCP status' });
    }
  });

  // ============================================================
  // Monitoramento
  // ============================================================

  app.post('/api/monitor/start', async (req: Request, res: Response) => {
    try {
      const { objective, priority } = req.body;
      if (!objective) {
        return res.status(400).json({ error: 'Objective is required' });
      }

      const task = await orchestrator.submitObjective(
        objective,
        priority || 'medium'
      );

      res.json({
        taskId: task.id,
        objective: task.objective,
        status: task.status,
        subtasks: task.subtasks.map((st) => ({
          id: st.id,
          agent: st.assignedAgent,
          objective: (st.objective || '').slice(0, 80),
          status: st.status,
          result: st.result?.summary,
        })),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/monitor/status/:taskId', (req: Request, res: Response) => {
    try {
      const task = orchestrator.getTaskStatus(req.params.taskId as string);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json({
        id: task.id,
        objective: task.objective,
        status: task.status,
        priority: task.priority,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        result: task.result,
        subtasks: task.subtasks.map((st) => ({
          id: st.id,
          agent: st.assignedAgent,
          objective: (st.objective || '').slice(0, 80),
          status: st.status,
          result: st.result?.summary,
          error: st.error,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch task status' });
    }
  });

  app.get('/api/monitor/tasks', (_req: Request, res: Response) => {
    try {
      const tasks = orchestrator.getActiveTasks();
      res.json({ tasks, count: tasks.length });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  // ============================================================
  // Relatorios
  // ============================================================

  app.post('/api/reports/generate', async (req: Request, res: Response) => {
    try {
      const { objective } = req.body;
      if (!objective) {
        return res.status(400).json({ error: 'Objective is required' });
      }

      const task = await orchestrator.submitObjective(
        `Gerar relatorio: ${objective}`,
        'high'
      );

      // Aguarda conclusao (simplificado)
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const completed = orchestrator.getTaskStatus(task.id);
      const reportSubtask = completed?.subtasks.find(
        (st) => st.assignedAgent === 'report_gen'
      );

      res.json({
        taskId: task.id,
        status: completed?.status,
        report: reportSubtask?.result?.data || null,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/reports/list', (_req: Request, res: Response) => {
    res.json({ reports: [], count: 0 });
  });

  // ============================================================
  // Alertas
  // ============================================================

  app.get('/api/alerts', (_req: Request, res: Response) => {
    res.json({ alerts: [], count: 0 });
  });

  app.post('/api/alerts/:alertId/acknowledge', (req: Request, res: Response) => {
    try {
      const acknowledged = crisisBot.acknowledgeAlert(req.params.alertId as string);
      res.json({ success: acknowledged });
    } catch (error) {
      res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
  });

  // ============================================================
  // Simulacao de Cenario (teste)
  // ============================================================

  app.post('/api/simulate/crisis', async (req: Request, res: Response) => {
    try {
      const { title, description, riskLevel, channels } = req.body;
      const result = await crisisBot.simulateScenario({
        title: title || 'Simulacao de Crise',
        description: description || 'Cenario simulado para teste',
        riskLevel: riskLevel || 'medium',
        affectedChannels: channels || ['dashboard'],
      });
      res.json(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: msg });
    }
  });

  // ============================================================
  // Memoria / Historico
  // ============================================================

  app.get('/api/memory/crises', (_req: Request, res: Response) => {
    try {
      const crises = memoryManager.relational.searchCrisesByKeyword('');
      res.json({ crises, count: crises.length });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch crisis history' });
    }
  });

  app.get('/api/memory/search', (req: Request, res: Response) => {
    try {
      const query = (req.query.q as string) || '';
      const context = memoryManager.getCombinedContext(query);
      res.json({
        semanticEntries: context.semanticEntries,
        historicalCrises: context.historicalCrises,
      });
    } catch (error) {
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // ============================================================
  // Auditoria
  // ============================================================

  app.get('/api/audit/logs', (req: Request, res: Response) => {
    try {
      const agentType = req.query.agentType as string | undefined;
      const action = req.query.action as string | undefined;
      const limitStr = req.query.limit as string | undefined;
      const entries = securityManager.auditLogger.query({
        agentType: agentType as AgentType | undefined,
        action: action,
        limit: limitStr ? parseInt(limitStr, 10) : undefined,
      });
      res.json({ entries, count: entries.length });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  });

  app.get('/api/audit/integrity', (_req: Request, res: Response) => {
    try {
      const integrity = securityManager.verifyAuditIntegrity();
      res.json(integrity);
    } catch (error) {
      res.status(500).json({ error: 'Failed to verify integrity' });
    }
  });

  // ============================================================
  // Anonimizacao (teste)
  // ============================================================

  app.post('/api/anonymize', (req: Request, res: Response) => {
    try {
      const { text, level } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }
      const result = securityManager.anonymizer.anonymize(text, level || 'moderate');
      res.json({ original: text, anonymized: result, level: level || 'moderate' });
    } catch (error) {
      res.status(500).json({ error: 'Anonymization failed' });
    }
  });

  // ============================================================
  // Serve Frontend (producao)
  // ============================================================

  if (process.env.NODE_ENV === 'production') {
    const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
    app.use(express.static(frontendDist));

    // Fallback SPA: qualquer rota que nao seja /api/* serve index.html
    app.use((req: Request, res: Response) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(frontendDist, 'index.html'));
      } else {
        res.status(404).json({ error: 'API route not found' });
      }
    });
  }

  return app;
}

// ============================================================
// Start Server
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

// Execucao direta
if (require.main === module) {
  startServer().catch((err) => {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  });
}
