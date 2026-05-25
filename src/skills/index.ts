/**
 * Skill Registry — Registro Centralizado de Habilidades
 *
 * Conecta o Skill Registry do core com os handlers implementados.
 * Cada habilidade registrada no registry ganha um handler funcional.
 */

import { SkillRegistry } from '../core/skill-registry';
import {
  handleSentimentAnalysis,
  handleEntityExtraction,
  handleAnomalyDetection,
  handleInfluenceGraphAnalysis,
  handleGenerateReport,
  handleCrisisSimulation,
} from './handlers';
import { logger } from '../utils';

/**
 * Inicializa todas as habilidades e registra seus handlers.
 */
export function initializeSkills(skillRegistry: SkillRegistry): void {
  const skills = skillRegistry.listSkills();

  const handlerMap: Record<string, (params: Record<string, unknown>) => Promise<unknown>> = {
    'sentiment_analysis': handleSentimentAnalysis,
    'entity_extraction': handleEntityExtraction,
    'anomaly_detection': handleAnomalyDetection,
    'influence_graph_analysis': handleInfluenceGraphAnalysis,
    'generate_markdown_report': handleGenerateReport,
    'crisis_scenario_simulation': handleCrisisSimulation,
  };

  for (const skill of skills) {
    const handler = handlerMap[skill.name];
    if (handler) {
      skillRegistry.registerHandler(skill.id, handler);
      logger.info({ skillName: skill.name }, 'Skill handler registered');
    } else {
      logger.warn({ skillName: skill.name }, 'No handler found for skill');
    }
  }

  logger.info(`Initialized ${skills.length} skill handlers`);
}
