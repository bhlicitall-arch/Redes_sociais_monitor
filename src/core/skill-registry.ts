/**
 * Skill Registry — Biblioteca de Habilidades dos Agentes
 *
 * Gerencia o registro, descoberta e execução de habilidades
 * especializadas que os agentes podem "aprender" e executar sob demanda.
 *
 * Habilidades planejadas:
 * - Análise de sentimento em português regional
 * - Extração de entidades de PDFs de editais
 * - Detecção de deepfakes em vídeos
 * - Classificação de tópicos por relevância
 * - Sumarização automática de crises
 */

import { Skill, SkillParameter, AgentType, EntityId } from '../types';
import { generateId, logger } from '../utils';

type SkillHandler = (params: Record<string, unknown>) => Promise<unknown>;

export class SkillRegistry {
  private skills: Map<EntityId, Skill> = new Map();
  private handlers: Map<EntityId, SkillHandler> = new Map();

  constructor() {
    this.registerBuiltinSkills();
    logger.info(`SkillRegistry initialized with ${this.skills.size} built-in skills`);
  }

  /**
   * Registra as habilidades nativas da plataforma.
   */
  private registerBuiltinSkills(): void {
    // Habilidade: Análise de Sentimento
    this.register({
      name: 'sentiment_analysis',
      description: 'Analisa o sentimento de textos em português (inclusive regional)',
      agentType: 'analyst',
      parameters: [
        { name: 'text', type: 'string', required: true, description: 'Texto para análise' },
        { name: 'language', type: 'string', required: false, description: 'Idioma do texto', defaultValue: 'pt-BR' },
      ],
      handler: 'handlers/sentiment-analysis',
      version: '1.0.0',
      enabled: true,
    });

    // Habilidade: Extração de Entidades
    this.register({
      name: 'entity_extraction',
      description: 'Extrai entidades nomeadas (pessoas, organizações, locais) de textos',
      agentType: 'analyst',
      parameters: [
        { name: 'text', type: 'string', required: true, description: 'Texto para extração' },
        { name: 'entityTypes', type: 'array', required: false, description: 'Tipos de entidade a extrair' },
      ],
      handler: 'handlers/entity-extraction',
      version: '1.0.0',
      enabled: true,
    });

    // Habilidade: Detecção de Anomalias
    this.register({
      name: 'anomaly_detection',
      description: 'Detecta padrões anômalos em séries temporais de menções',
      agentType: 'risk_detector',
      parameters: [
        { name: 'timeSeriesData', type: 'array', required: true, description: 'Dados da série temporal' },
        { name: 'sensitivity', type: 'number', required: false, description: 'Sensibilidade da detecção', defaultValue: 0.8 },
      ],
      handler: 'handlers/anomaly-detection',
      version: '1.0.0',
      enabled: true,
    });

    // Habilidade: Análise de Grafos de Influência
    this.register({
      name: 'influence_graph_analysis',
      description: 'Analisa grafos de influência para identificar propagadores chave',
      agentType: 'risk_detector',
      parameters: [
        { name: 'mentions', type: 'array', required: true, description: 'Lista de menções com metadados' },
        { name: 'maxDepth', type: 'number', required: false, description: 'Profundidade máxima do grafo', defaultValue: 3 },
      ],
      handler: 'handlers/influence-graph',
      version: '1.0.0',
      enabled: true,
    });

    // Habilidade: Geração de Relatório em Markdown
    this.register({
      name: 'generate_markdown_report',
      description: 'Compila dados em relatório Markdown profissional',
      agentType: 'report_gen',
      parameters: [
        { name: 'title', type: 'string', required: true, description: 'Título do relatório' },
        { name: 'sections', type: 'array', required: true, description: 'Seções do relatório' },
        { name: 'format', type: 'string', required: false, description: 'Formato de saída', defaultValue: 'markdown' },
      ],
      handler: 'handlers/generate-report',
      version: '1.0.0',
      enabled: true,
    });

    // Habilidade: Simulação de Cenários de Crise
    this.register({
      name: 'crisis_scenario_simulation',
      description: 'Simula cenários de crise baseados em protocolos pré-aprovados',
      agentType: 'crisis_bot',
      parameters: [
        { name: 'scenario', type: 'object', required: true, description: 'Descrição do cenário de crise' },
        { name: 'protocolId', type: 'string', required: false, description: 'ID do protocolo a usar' },
      ],
      handler: 'handlers/crisis-simulation',
      version: '1.0.0',
      enabled: true,
    });
  }

  /**
   * Registra uma nova habilidade no registry.
   */
  register(skillDef: Omit<Skill, 'id'>): EntityId {
    const id = generateId();
    const skill: Skill = { ...skillDef, id };
    this.skills.set(id, skill);
    return id;
  }

  /**
   * Vincula um handler a uma habilidade registrada.
   */
  registerHandler(skillId: EntityId, handler: SkillHandler): void {
    if (!this.skills.has(skillId)) {
      throw new Error(`Skill ${skillId} not found`);
    }
    this.handlers.set(skillId, handler);
  }

  /**
   * Busca habilidades por tipo de agente.
   */
  getSkillsByAgent(agentType: AgentType): Skill[] {
    return Array.from(this.skills.values()).filter(
      (s) => s.agentType === agentType && s.enabled
    );
  }

  /**
   * Executa uma habilidade registrada.
   */
  async execute(skillId: EntityId, params: Record<string, unknown>): Promise<unknown> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`Skill ${skillId} not found`);
    }

    const handler = this.handlers.get(skillId);
    if (!handler) {
      throw new Error(`Handler for skill ${skill.name} not registered`);
    }

    logger.info({ skillName: skill.name, params }, 'Executing skill');
    return handler(params);
  }

  /**
   * Lista todas as habilidades disponíveis.
   */
  listSkills(): Skill[] {
    return Array.from(this.skills.values());
  }
}
