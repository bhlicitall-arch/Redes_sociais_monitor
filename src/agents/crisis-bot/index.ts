/**
 * Crisis Bot — Gestão Inteligente de Crises Reputacionais
 *
 * Responsabilidades:
 * - Sugerir protocolos de resposta pré-aprovados
 * - Executar árvores de decisão em situações críticas
 * - Simular cenários de crise
 * - Disparar alertas multicanal (Slack, WhatsApp, Email)
 * - Recomendar estratégias de comunicação baseadas em dados
 * - Acompanhar execução e evolução da crise
 *
 * Árvores de decisão: cada nível de risco (low, medium, high, critical)
 * ativa um protocolo diferente com steps específicos.
 */

import { BaseAgent } from '../base-agent';
import {
  Task,
  TaskResult,
  AgentType,
  RiskAssessment,
  RiskLevel,
  CrisisProtocol,
  CrisisStep,
  Alert,
  AlertChannel,
  RiskAssessment as RiskAssessmentType,
} from '../../types';
import { generateId, now, logger } from '../../utils';

// Protocolos de resposta pré-aprovados por nível de risco
const DEFAULT_PROTOCOLS: Record<RiskLevel, CrisisProtocol> = {
  low: {
    id: 'proto-low',
    name: 'Protocolo de Rotina',
    description: 'Monitoramento padrão sem necessidade de intervenção.',
    triggerConditions: [{ field: 'riskLevel', operator: 'eq', value: 'low' }],
    steps: [
      {
        order: 1,
        action: 'Registrar no log de monitoramento',
        responsibleRole: 'sistema',
        expectedOutcome: 'Registro armazenado para análise futura',
        timeoutMinutes: 60,
      },
    ],
    approved: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  medium: {
    id: 'proto-medium',
    name: 'Protocolo de Atenção',
    description: 'Sinal amarelo — requer atenção da equipe de comunicação.',
    triggerConditions: [{ field: 'riskLevel', operator: 'eq', value: 'medium' }],
    steps: [
      {
        order: 1,
        action: 'Notificar equipe de comunicação',
        responsibleRole: 'analista_comunicacao',
        expectedOutcome: 'Equipe ciente da situação',
        timeoutMinutes: 30,
      },
      {
        order: 2,
        action: 'Preparar briefing informativo',
        responsibleRole: 'analista_comunicacao',
        expectedOutcome: 'Briefing com dados da situação preparado',
        timeoutMinutes: 120,
      },
      {
        order: 3,
        action: 'Monitorar evolução nas próximas 4h',
        responsibleRole: 'sistema',
        expectedOutcome: 'Reavaliação do nível de risco após período',
        timeoutMinutes: 240,
      },
    ],
    approved: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-06-01'),
  },
  high: {
    id: 'proto-high',
    name: 'Protocolo de Crise',
    description: 'Situação de crise iminente — ação coordenada necessária.',
    triggerConditions: [{ field: 'riskLevel', operator: 'gte', value: 'high' }],
    steps: [
      {
        order: 1,
        action: 'Alertar diretor de comunicação imediatamente',
        responsibleRole: 'diretor_comunicacao',
        expectedOutcome: 'Diretor ciente e acionado',
        timeoutMinutes: 5,
      },
      {
        order: 2,
        action: 'Convocar comitê de crise emergencial',
        responsibleRole: 'diretor_comunicacao',
        expectedOutcome: 'Comitê reunido em até 30 min',
        timeoutMinutes: 30,
      },
      {
        order: 3,
        action: 'Preparar nota oficial preliminar',
        responsibleRole: 'assessoria_imprensa',
        expectedOutcome: 'Nota elaborada e aprovada',
        timeoutMinutes: 60,
      },
      {
        order: 4,
        action: 'Ativar monitoramento em tempo real',
        responsibleRole: 'sistema',
        expectedOutcome: 'Coleta e análise em intervalo reduzido',
        timeoutMinutes: 10,
      },
      {
        order: 5,
        action: 'Reavaliar situação a cada 2h',
        responsibleRole: 'comite_crise',
        expectedOutcome: 'Decisão sobre escalonamento ou desmobilização',
        timeoutMinutes: 120,
      },
    ],
    approved: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-06-01'),
  },
  critical: {
    id: 'proto-critical',
    name: 'Protocolo de Crise Máxima',
    description: 'Crise reputacional grave — resposta institucional no mais alto nível.',
    triggerConditions: [{ field: 'riskLevel', operator: 'eq', value: 'critical' }],
    steps: [
      {
        order: 1,
        action: 'Alertar secretário e gabinete',
        responsibleRole: 'secretario',
        expectedOutcome: 'Alta gestão ciente e acionada',
        timeoutMinutes: 5,
      },
      {
        order: 2,
        action: 'Notificar procuradoria jurídica',
        responsibleRole: 'procuradoria',
        expectedOutcome: 'Avaliação jurídica da situação',
        timeoutMinutes: 15,
      },
      {
        order: 3,
        action: 'Convocar comitê de crise completo',
        responsibleRole: 'secretario',
        expectedOutcome: 'Comitê reunido em até 20 min',
        timeoutMinutes: 20,
      },
      {
        order: 4,
        action: 'Elaborar nota oficial e release',
        responsibleRole: 'assessoria_imprensa',
        expectedOutcome: 'Nota e release aprovados pela alta gestão',
        timeoutMinutes: 30,
      },
      {
        order: 5,
        action: 'Acionar canais oficiais de resposta',
        responsibleRole: 'comunicacao',
        expectedOutcome: 'Resposta publicada em todos os canais',
        timeoutMinutes: 60,
      },
      {
        order: 6,
        action: 'Plantão de monitoramento 24h',
        responsibleRole: 'sistema',
        expectedOutcome: 'Cobertura contínua com relatórios de hora em hora',
        timeoutMinutes: 1440,
      },
      {
        order: 7,
        action: 'Coletar e armazenar lições aprendidas',
        responsibleRole: 'sistema',
        expectedOutcome: 'Registro na memória de crises para aprendizado futuro',
        timeoutMinutes: 720,
      },
    ],
    approved: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-06-01'),
  },
};

export class CrisisBotAgent extends BaseAgent {
  readonly type: AgentType = 'crisis_bot';
  private activeAlerts: Map<string, Alert> = new Map();
  private activeProtocols: Map<string, CrisisProtocol> = new Map();

  constructor() {
    super();
    logger.info('Crisis Bot Agent initialized');
  }

  async execute(task: Task): Promise<TaskResult> {
    this.logStart(task);

    try {
      // Extrai avaliações de risco da tarefa anterior
      const assessments = this.extractAssessments(task);

      if (!assessments || assessments.length === 0) {
        return this.success(
          { alerts: [], protocolsActivated: [] },
          'No risk assessments to process',
          { alertsSent: 0 }
        );
      }

      const alerts: Alert[] = [];
      const protocolsActivated: CrisisProtocol[] = [];

      for (const assessment of assessments) {
        // Dispara alerta se necessário
        const alert = await this.evaluateAndAlert(assessment);
        if (alert) {
          alerts.push(alert);
          this.activeAlerts.set(alert.id, alert);
        }

        // Ativa protocolo se risco for alto ou crítico
        if (assessment.riskLevel === 'high' || assessment.riskLevel === 'critical') {
          const protocol = this.activateProtocol(assessment);
          if (protocol) {
            protocolsActivated.push(protocol);
            this.activeProtocols.set(protocol.id, protocol);
          }
        }
      }

      logger.info({
        alertsSent: alerts.length,
        protocolsActivated: protocolsActivated.length,
      }, 'Crisis Bot: execution completed');

      return this.success(
        {
          alerts,
          protocolsActivated,
          activeCrisisCount: protocolsActivated.length,
        },
        `${alerts.length} alertas disparados, ${protocolsActivated.length} protocolos ativados`,
        {
          alertsSent: alerts.length,
          protocolsActivatedCount: protocolsActivated.length,
          activeCrisisCount: protocolsActivated.length,
        }
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return this.failure(`Crisis response failed: ${msg}`);
    }
  }

  /**
   * Extrai avaliações de risco do resultado da tarefa do Risk Detector.
   */
  private extractAssessments(task: Task): RiskAssessment[] | null {
    // Verifica subtarefas
    if (task.subtasks) {
      for (const subtask of task.subtasks) {
        if (subtask.assignedAgent === 'risk_detector' && subtask.result?.data) {
          const data = subtask.result.data as { assessments?: RiskAssessment[] };
          if (data.assessments) return data.assessments;
        }
      }
    }
    // Verifica resultado direto
    if (task.result?.data) {
      const data = task.result.data as { assessments?: RiskAssessment[] };
      if (data.assessments) return data.assessments;
    }
    return null;
  }

  /**
   * Avalia um risk assessment e dispara alertas se necessário.
   */
  private async evaluateAndAlert(assessment: RiskAssessment): Promise<Alert | null> {
    if (assessment.riskLevel === 'low') {
      return null;
    }

    const alertChannels = this.determineChannels(assessment.riskLevel);
    const message = this.buildAlertMessage(assessment);
    const severity = assessment.riskLevel;

    const alert: Alert = {
      id: generateId(),
      triggeredAt: now(),
      riskAssessmentId: assessment.mentionId,
      channels: alertChannels,
      message,
      severity,
      acknowledged: false,
    };

    // Simula disparo dos alertas
    logger.info({ alertId: alert.id, channels: alertChannels }, 'Alert dispatched');
    for (const channel of alertChannels) {
      logger.info({ channel, message: message.slice(0, 100) }, `Alert sent via ${channel}`);
    }

    return alert;
  }

  /**
   * Determina os canais de alerta baseado no nível de severidade.
   */
  private determineChannels(level: RiskLevel): AlertChannel[] {
    switch (level) {
      case 'critical':
        return ['sms', 'whatsapp', 'slack', 'email', 'dashboard'];
      case 'high':
        return ['whatsapp', 'slack', 'email', 'dashboard'];
      case 'medium':
        return ['slack', 'email', 'dashboard'];
      default:
        return ['dashboard'];
    }
  }

  /**
   * Constrói mensagem de alerta baseada na avaliação de risco.
   */
  private buildAlertMessage(assessment: RiskAssessment): string {
    const riskEmoji =
      assessment.riskLevel === 'critical' ? '🚨🔴' :
      assessment.riskLevel === 'high' ? '🔴' :
      assessment.riskLevel === 'medium' ? '🟡' : '🟢';

    const topFactors = assessment.contributingFactors
      .filter((f) => f.weight > 0.1)
      .map((f) => `• ${f.name}: ${f.description}`)
      .join('\n');

    return [
      `${riskEmoji} [${assessment.riskLevel.toUpperCase()}] Alerta de Monitoramento`,
      ``,
      `Score de Risco: ${(assessment.riskScore * 100).toFixed(0)}%`,
      `Probabilidade de Propagação: ${(assessment.predictedSpread! * 100).toFixed(0)}%`,
      ``,
      `Fatores contribuintes:`,
      topFactors || 'Nenhum fator significativo',
      ``,
      `ID da avaliação: ${assessment.mentionId.slice(0, 8)}...`,
      `Timestamp: ${now().toISOString()}`,
    ].join('\n');
  }

  /**
   * Ativa o protocolo de crise apropriado para o nível de risco.
   */
  private activateProtocol(assessment: RiskAssessment): CrisisProtocol | null {
    const protocol = DEFAULT_PROTOCOLS[assessment.riskLevel];
    if (!protocol) return null;

    logger.info({
      protocolId: protocol.id,
      protocolName: protocol.name,
      riskLevel: assessment.riskLevel,
    }, 'Crisis protocol activated');

    // Simula execução dos steps
    for (const step of protocol.steps) {
      logger.info({
        step: step.order,
        action: step.action,
        responsible: step.responsibleRole,
        timeout: step.timeoutMinutes,
      }, 'Protocol step queued');
    }

    return protocol;
  }

  /**
   * Simula um cenário de crise para teste/training.
   */
  async simulateScenario(scenario: {
    title: string;
    description: string;
    riskLevel: RiskLevel;
    affectedChannels: AlertChannel[];
  }): Promise<TaskResult> {
    logger.info({ scenario: scenario.title }, 'Simulating crisis scenario');

    const assessment: RiskAssessment = {
      mentionId: generateId(),
      riskLevel: scenario.riskLevel,
      riskScore: scenario.riskLevel === 'critical' ? 0.85 :
                 scenario.riskLevel === 'high' ? 0.65 :
                 scenario.riskLevel === 'medium' ? 0.35 : 0.15,
      contributingFactors: [
        { name: 'test_scenario', weight: 1.0, description: scenario.description },
      ],
      predictedSpread: scenario.riskLevel === 'critical' ? 0.9 :
                        scenario.riskLevel === 'high' ? 0.7 : 0.4,
      assessedAt: now(),
    };

    const alert = await this.evaluateAndAlert(assessment);
    const protocol = this.activateProtocol(assessment);

    return this.success(
      {
        scenario: scenario.title,
        assessment,
        alert,
        protocolActivated: protocol?.name,
      },
      `Scenario "${scenario.title}" simulated successfully`,
      { riskLevel: assessment.riskScore }
    );
  }

  /**
   * Obtém o status de um alerta específico.
   */
  getAlertStatus(alertId: string): Alert | undefined {
    return this.activeAlerts.get(alertId);
  }

  /**
   * Reconhece um alerta manualmente.
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedAt = now();
    return true;
  }

  /**
   * Marca um protocolo como concluído.
   */
  closeProtocol(protocolId: string): boolean {
    return this.activeProtocols.delete(protocolId);
  }
}
