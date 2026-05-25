/**
 * Agent Manager — Gerenciador de Sub-Agentes
 *
 * Responsável por instanciar, gerenciar e coordenar a comunicação
 * entre os agentes especializados da plataforma.
 *
 * Atua como um middleware entre o Orchestrator e os agentes,
 * garantindo que as tarefas sejam roteadas corretamente.
 */

import { Task, TaskResult, AgentType } from '../types';
import { logger } from '../utils';

// Interfaces dos handlers dos agentes
interface IAgent {
  readonly type: AgentType;
  execute(task: Task): Promise<TaskResult>;
}

export class AgentManager {
  private agents: Map<AgentType, IAgent> = new Map();

  constructor() {
    logger.info('AgentManager initialized');
  }

  /**
   * Registra um agente no gerenciador.
   */
  registerAgent(agent: IAgent): void {
    if (this.agents.has(agent.type)) {
      logger.warn({ agentType: agent.type }, 'Overwriting existing agent registration');
    }
    this.agents.set(agent.type, agent);
    logger.info({ agentType: agent.type }, 'Agent registered');
  }

  /**
   * Obtém um agente registrado pelo tipo.
   */
  getAgent(type: AgentType): IAgent | undefined {
    return this.agents.get(type);
  }

  /**
   * Executa uma tarefa delegando ao agente apropriado.
   */
  async executeTask(task: Task): Promise<TaskResult> {
    const agentType = task.assignedAgent;
    if (!agentType) {
      throw new Error(`Task ${task.id} has no assigned agent`);
    }

    const agent = this.agents.get(agentType);
    if (!agent) {
      throw new Error(`Agent ${agentType} not registered. Execute tasks after all agents are initialized.`);
    }

    logger.info({ taskId: task.id, agentType }, 'AgentManager: delegating task');
    return agent.execute(task);
  }

  /**
   * Lista todos os agentes registrados.
   */
  listAgents(): AgentType[] {
    return Array.from(this.agents.keys());
  }
}
