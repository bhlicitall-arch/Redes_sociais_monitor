/**
 * Base Agent — Classe abstrata para todos os sub-agentes
 *
 * Define o contrato comum: execução de tarefas, logging,
 * registro de auditoria e acesso ao Skill Registry.
 */

import { Task, TaskResult, AgentType } from '../types';
import { logger } from '../utils';

export interface IAgent {
  readonly type: AgentType;
  execute(task: Task): Promise<TaskResult>;
}

export abstract class BaseAgent implements IAgent {
  public abstract readonly type: AgentType;

  /**
   * Executa uma tarefa delegada pelo AgentManager.
   * Cada agente implementa sua lógica específica aqui.
   */
  abstract execute(task: Task): Promise<TaskResult>;

  /**
   * Loga o início da execução de uma tarefa.
   */
  protected logStart(task: Task): void {
    logger.info({
      agent: this.type,
      taskId: task.id,
      objective: task.objective,
    }, `${this.type}: starting task`);
  }

  /**
   * Cria um resultado de sucesso.
   */
  protected success(data: unknown, summary: string, metrics?: Record<string, number>): TaskResult {
    return {
      success: true,
      data,
      summary,
      metrics,
    };
  }

  /**
   * Cria um resultado de falha.
   */
  protected failure(error: string): TaskResult {
    return {
      success: false,
      summary: error,
    };
  }
}
