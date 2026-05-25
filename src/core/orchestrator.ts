/**
 * Orquestrador Agentic — Cérebro Central da Plataforma
 *
 * Responsabilidades:
 * - Receber objetivos de alto nível e decompor em subtarefas
 * - Gerenciar ciclo de vida de todas as tarefas
 * - Coordenar a comunicação entre sub-agentes
 * - Avaliar progresso e adaptar estratégias
 */

import {
  Task,
  TaskStatus,
  AgentType,
  TaskPriority,
  TaskResult,
  EntityId,
  Mention,
  AnalysisResult,
  RiskAssessment,
} from '../types';
import { generateId, now, logger } from '../utils';
import { memoryManager } from '../memory';
import { SkillRegistry } from '../core/skill-registry';
import { AgentManager } from '../core/agent-manager';
import { AuditLogger } from '../security/audit';

export class Orchestrator {
  private tasks: Map<EntityId, Task> = new Map();
  private skillRegistry: SkillRegistry;
  public agentManager: AgentManager;
  private auditLogger: AuditLogger;
  private running: boolean = false;

  constructor(agentManager?: AgentManager, auditLogger?: AuditLogger) {
    this.skillRegistry = new SkillRegistry();
    this.agentManager = agentManager || new AgentManager();
    this.auditLogger = auditLogger || new AuditLogger();
    logger.info('Orchestrator Agentic initialized');
  }

  /**
   * Recebe um objetivo de alto nível e inicia o processo de orquestração.
   *
   * @param objective - Objetivo descritivo (ex: "Monitore a reputação da SETUR/CE em relação ao novo polo turístico")
   * @returns A tarefa raiz criada
   */
  async submitObjective(objective: string, priority: TaskPriority = 'medium'): Promise<Task> {
    const rootTask: Task = {
      id: generateId(),
      objective,
      status: 'pending',
      priority,
      assignedAgent: 'orchestrator',
      subtasks: [],
      createdAt: now(),
    };

    this.tasks.set(rootTask.id, rootTask);
    logger.info({ taskId: rootTask.id, objective }, 'New objective submitted');

    // Registro de auditoria
    await this.auditLogger.log({
      agentType: 'orchestrator',
      action: 'objective_submitted',
      resourceType: 'task',
      resourceId: rootTask.id,
      details: `Objective: ${objective}`,
      severity: 'info',
    });

    // Inicia o processo de decomposição
    await this.decomposeAndExecute(rootTask);

    return rootTask;
  }

  /**
   * Decompõe um objetivo em subtarefas executáveis e as distribui.
   */
  private async decomposeAndExecute(task: Task): Promise<void> {
    task.status = 'in_progress';
    logger.info({ taskId: task.id }, 'Decomposing objective into subtasks');

    // Busca contexto histórico para enriquecer a decomposição
    const context = memoryManager.getCombinedContext(task.objective);

    // Decomposição baseada em regras + histórico
    const subtasks = this.decomposeObjective(task, context);

    task.subtasks = subtasks;
    logger.info({ taskId: task.id, subtaskCount: subtasks.length }, 'Objective decomposed');

    // Executa sub-tarefas em sequência, passando resultados acumulados entre elas
    const accumulatedResults: Record<string, unknown> = {};
    for (const subtask of subtasks) {
      this.tasks.set(subtask.id, subtask);

      // Injeta resultados acumulados + metadados de projeto como contexto
      subtask.metadata = {
        ...subtask.metadata,
        accumulatedResults: { ...accumulatedResults },
        taskId: task.id,
      };

      await this.dispatchTask(subtask);

      // Acumula resultado deste agente para os próximos
      if (subtask.result?.data && typeof subtask.result.data === 'object') {
        const data = subtask.result.data as Record<string, unknown>;
        Object.assign(accumulatedResults, data);

        // Persiste menções no banco se for o Collector
        if (subtask.assignedAgent === 'collector' && Array.isArray(data.mentions)) {
          this.persistMentions(data.mentions as Mention[], subtask.id);
        }
        // Persiste análises e associa ao task ID
        if (subtask.assignedAgent === 'analyst' && Array.isArray(data.analyses)) {
          this.persistAnalyses(data.analyses as AnalysisResult[], subtask.id);
        }
        if (subtask.assignedAgent === 'risk_detector' && Array.isArray(data.assessments)) {
          this.persistAssessments(data.assessments as RiskAssessment[], subtask.id);
        }
      }
    }

    // Compila resultados
    const results = subtasks
      .filter((st) => st.result)
      .map((st) => st.result!);

    // Persiste task principal no banco
    try {
      const { getDb } = require('../db');
      const db = getDb();
      db.prepare(`
        INSERT OR REPLACE INTO project_tasks (id, tenant_id, type, status, result, started_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(task.id, 'system', 'monitoring', task.status,
        JSON.stringify({ summary: task.result?.summary, subtaskCount: subtasks.length }),
        task.createdAt.toISOString(), now().toISOString()
      );
    } catch { /* db not available */ }

    task.result = {
      success: results.every((r) => r.success),
      data: results,
      summary: `Completed ${results.filter((r) => r.success).length}/${subtasks.length} subtasks`,
    };
    task.status = 'completed';
    task.completedAt = now();

    logger.info({ taskId: task.id, status: task.status }, 'Objective completed');
  }

  /**
   * Decompõe um objetivo em subtarefas específicas para cada agente.
   * Implementa a lógica de planejamento baseada no tipo de objetivo.
   */
  private decomposeObjective(task: Task, context: unknown): Task[] {
    const subtasks: Task[] = [];

    // 1. Coleta de dados → Collector Agent
    subtasks.push(this.createSubtask(
      task.id,
      `Coletar menções relacionadas a: ${task.objective}`,
      'high',
      'collector'
    ));

    // 2. Análise de sentimento → Analyst Agent
    subtasks.push(this.createSubtask(
      task.id,
      `Analisar sentimento e relevância das menções coletadas para: ${task.objective}`,
      'high',
      'analyst'
    ));

    // 3. Detecção de riscos → Risk Detector Agent
    subtasks.push(this.createSubtask(
      task.id,
      `Detectar padrões de risco e anomalias nas menções analisadas para: ${task.objective}`,
      'high',
      'risk_detector'
    ));

    // 4. Geração de relatório → Report Gen Agent
    subtasks.push(this.createSubtask(
      task.id,
      `Gerar relatório consolidado com dados, análises e recomendações para: ${task.objective}`,
      'medium',
      'report_gen'
    ));

    return subtasks;
  }

  private createSubtask(
    parentId: EntityId,
    objective: string,
    priority: TaskPriority,
    agentType: AgentType
  ): Task {
    return {
      id: generateId(),
      parentTaskId: parentId,
      objective,
      status: 'pending',
      priority,
      assignedAgent: agentType,
      subtasks: [],
      createdAt: now(),
    };
  }

  /**
   * Distribui uma tarefa para o agente apropriado.
   */
  private async dispatchTask(task: Task): Promise<void> {
    task.status = 'assigned';
    logger.info({ taskId: task.id, agent: task.assignedAgent }, 'Dispatching task to agent');

    await this.auditLogger.log({
      agentType: 'orchestrator',
      action: 'task_assigned',
      resourceType: 'task',
      resourceId: task.id,
      details: `Assigned to ${task.assignedAgent}: ${task.objective}`,
      severity: 'info',
    });

    try {
      const result = await this.agentManager.executeTask(task);
      task.status = 'completed';
      task.result = result;
      task.completedAt = now();
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      logger.error({ taskId: task.id, error: task.error }, 'Task failed');
    }
  }

  /**
   * Persiste menções no banco de dados.
   */
  private persistMentions(mentions: Mention[], subtaskId: string): void {
    try {
      const { getDb } = require('../db');
      const db = getDb();
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO mention_records (id, project_id, tenant_id, task_id, platform, author, content, url, language, region, engagement, collected_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertMany = db.transaction((items: Mention[]) => {
        for (const m of items) {
          stmt.run(
            m.id, '', 'system', subtaskId,
            m.source.platform, m.source.author || '', m.rawContent,
            m.source.url || '', m.source.language || 'pt-BR',
            m.source.region || '',
            m.source.engagement ? JSON.stringify(m.source.engagement) : null,
            m.collectedAt.toISOString(),
          );
        }
      });
      insertMany(mentions);
      logger.info({ count: mentions.length }, 'Orchestrator: mentions persisted');
    } catch (e) {
      logger.warn({ error: String(e) }, 'Orchestrator: failed to persist mentions');
    }
  }

  private persistAnalyses(analyses: AnalysisResult[], subtaskId: string): void {
    try {
      const { getDb } = require('../db');
      const db = getDb();
      for (const a of analyses) {
        db.prepare(`
          UPDATE mention_records SET sentiment_label = ?, sentiment_score = ? WHERE id = ?
        `).run(a.sentiment, a.sentimentScore, a.mentionId);
      }
      logger.info({ count: analyses.length }, 'Orchestrator: analyses persisted');
    } catch { /* ignore */ }
  }

  private persistAssessments(assessments: RiskAssessment[], subtaskId: string): void {
    try {
      const { getDb } = require('../db');
      const db = getDb();
      for (const a of assessments) {
        db.prepare(`
          UPDATE mention_records SET risk_level = ?, risk_score = ? WHERE id = ?
        `).run(a.riskLevel, a.riskScore, a.mentionId);
      }
      logger.info({ count: assessments.length }, 'Orchestrator: risk assessments persisted');
    } catch { /* ignore */ }
  }

  /**
   * Retorna o status de uma tarefa.
   */
  getTaskStatus(taskId: EntityId): Task | undefined {
    return this.tasks.get(taskId);

    // Fallback: busca do banco
    try {
      const { getDb } = require('../db');
      const db = getDb();
      const row = db.prepare('SELECT * FROM project_tasks WHERE orchestrator_task_id = ?').get(taskId) as any;
      if (row) {
        return {
          id: row.id,
          objective: row.type,
          status: row.status,
          priority: 'medium',
          assignedAgent: 'orchestrator',
          subtasks: [],
          createdAt: new Date(row.created_at),
          result: row.result ? JSON.parse(row.result) : undefined,
        };
      }
    } catch { /* no db */ }
    return undefined;
  }

  /**
   * Lista todas as tarefas ativas.
   */
  getActiveTasks(): Task[] {
    return Array.from(this.tasks.values()).filter(
      (t) => t.status === 'pending' || t.status === 'assigned' || t.status === 'in_progress'
    );
  }

  /**
   * Lista tasks históricas do banco.
   */
  getHistoryTasks(limit = 20): any[] {
    try {
      const { getDb } = require('../db');
      const db = getDb();
      return db.prepare(
        'SELECT * FROM project_tasks ORDER BY created_at DESC LIMIT ?'
      ).all(limit);
    } catch { return []; }
  }

  /**
   * Obtém menções persistidas de uma tarefa.
   */
  getTaskMentions(taskId: string): any[] {
    try {
      const { getDb } = require('../db');
      const db = getDb();
      return db.prepare(
        'SELECT * FROM mention_records WHERE task_id = ? OR project_id = ? ORDER BY collected_at DESC LIMIT 100'
      ).all(taskId, taskId);
    } catch { return []; }
  }

  /**
   * Cancela uma tarefa em andamento.
   */
  cancelTask(taskId: EntityId): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.status = 'cancelled';
    logger.info({ taskId }, 'Task cancelled');
    return true;
  }
}
