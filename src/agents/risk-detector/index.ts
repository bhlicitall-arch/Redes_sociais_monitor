/**
 * Risk Detector Agent — Identificador Proativo de Crises Reputacionais
 *
 * Responsabilidades:
 * - Detectar padrões anômalos em séries temporais de menções
 * - Calcular nível de risco de cada menção
 * - Comparar com memória histórica de crises
 * - Analisar grafos de influência para identificar propagadores
 * - Predizer probabilidade de propagação
 *
 * Algoritmos:
 * - Z-Score para detecção de anomalias (desvio do volume histórico)
 * - Análise de frequência de sentimento negativo
 * - Similaridade com crises passadas via memória vetorial
 */

import { BaseAgent } from '../base-agent';
import {
  Task,
  TaskResult,
  AgentType,
  Mention,
  AnalysisResult,
  RiskAssessment,
  RiskLevel,
  RiskFactor,
  HistoricalCrisisRecord,
} from '../../types';
import { generateId, now, logger } from '../../utils';
import { memoryManager } from '../../memory';

// Pesos para os fatores de risco
const RISK_WEIGHTS = {
  negativeSentiment: 0.35,
  highVolume: 0.20,
  influentialAuthor: 0.15,
  historicalSimilarity: 0.20,
  engagementVelocity: 0.10,
};

export class RiskDetectorAgent extends BaseAgent {
  readonly type: AgentType = 'risk_detector';

  // Janela temporal para cálculo de baseline (em ms)
  private readonly BASELINE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

  constructor() {
    super();
    logger.info('Risk Detector Agent initialized');
  }

  async execute(task: Task): Promise<TaskResult> {
    this.logStart(task);

    try {
      // Extrai análises das tarefas anteriores
      const analyses = this.extractAnalyses(task);

      if (!analyses || analyses.length === 0) {
        return this.success(
          { assessments: [] },
          'No analyses to assess risk',
          { totalAssessed: 0 }
        );
      }

      const assessments: RiskAssessment[] = [];

      for (const analysis of analyses) {
        const assessment = await this.assessRisk(analysis);
        assessments.push(assessment);
      }

      // Identifica crises potenciais (alto/crítico)
      const highRisk = assessments.filter(
        (a) => a.riskLevel === 'high' || a.riskLevel === 'critical'
      );

      logger.info({
        totalAssessed: assessments.length,
        highRiskCount: highRisk.length,
        riskDistribution: this.getRiskDistribution(assessments),
      }, 'Risk Detector: assessment completed');

      return this.success(
        { assessments, highRiskAlerts: highRisk },
        `Risk assessment: ${highRisk.length}/${assessments.length} high/critical risk items detected`,
        {
          totalAssessed: assessments.length,
          highRiskCount: highRisk.length,
          mediumRiskCount: assessments.filter((a) => a.riskLevel === 'medium').length,
          lowRiskCount: assessments.filter((a) => a.riskLevel === 'low').length,
        }
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return this.failure(`Risk assessment failed: ${msg}`);
    }
  }

  /**
   * Extrai análises do resultado da tarefa anterior.
   * Primeiro tenta dos accumulatedResults (encadeamento do orchestrator),
   * depois do próprio resultado.
   */
  private extractAnalyses(task: Task): AnalysisResult[] | null {
    // 1. Tenta dos resultados acumulados do orchestrator
    const accumulated = task.metadata?.accumulatedResults as Record<string, unknown> | undefined;
    if (accumulated?.analyses && Array.isArray(accumulated.analyses)) {
      logger.info({ analysisCount: accumulated.analyses.length }, 'RiskDetector: using analyses from accumulated results');
      return accumulated.analyses as AnalysisResult[];
    }

    // 2. Tenta do resultado direto
    if (task.result?.data && typeof task.result.data === 'object') {
      const data = task.result.data as { analyses?: AnalysisResult[] };
      if (data.analyses) {
        return data.analyses;
      }
    }
    return null;
  }

  /**
   * Avalia o risco de uma análise individual.
   * Combina múltiplos fatores em um score composto.
   */
  private async assessRisk(analysis: AnalysisResult): Promise<RiskAssessment> {
    const factors: RiskFactor[] = [];

    // Fator 1: Sentimento negativo
    const sentimentFactor = this.evaluateSentimentFactor(analysis);
    factors.push(sentimentFactor);

    // Fator 2: Similaridade histórica com crises passadas
    const historicalFactor = await this.evaluateHistoricalFactor(analysis);
    factors.push(historicalFactor);

    // Fator 3: Volume/velocidade de engajamento
    const engagementFactor = this.evaluateEngagementFactor(analysis);
    factors.push(engagementFactor);

    // Fator 4: Presença de entidades de alto risco
    const entityFactor = this.evaluateEntityFactor(analysis);
    factors.push(entityFactor);

    // Calcula score composto ponderado
    const riskScore = this.calculateCompositeScore(factors);

    // Determina nível de risco
    const riskLevel = this.classifyRiskLevel(riskScore);

    // Prediz probabilidade de propagação
    const predictedSpread = this.predictSpread(riskScore, analysis);

    return {
      mentionId: analysis.mentionId,
      riskLevel,
      riskScore,
      contributingFactors: factors,
      predictedSpread,
      assessedAt: now(),
    };
  }

  /**
   * Avalia fator de sentimento: quanto mais negativo, maior o risco.
   */
  private evaluateSentimentFactor(analysis: AnalysisResult): RiskFactor {
    let weight = 0;
    const negativeScore = analysis.sentimentScore < 0 ? Math.abs(analysis.sentimentScore) : 0;

    if (analysis.sentiment === 'very_negative') {
      weight = 0.9;
    } else if (analysis.sentiment === 'negative') {
      weight = 0.6;
    } else if (analysis.sentiment === 'neutral' && negativeScore > 0) {
      weight = 0.3;
    }

    return {
      name: 'negative_sentiment',
      weight: weight * RISK_WEIGHTS.negativeSentiment,
      description: `Sentimento: ${analysis.sentiment} (score: ${analysis.sentimentScore.toFixed(3)})`,
    };
  }

  /**
   * Avalia similaridade com crises históricas registradas na memória.
   */
  private async evaluateHistoricalFactor(analysis: AnalysisResult): Promise<RiskFactor> {
    const context = memoryManager.getCombinedContext(
      analysis.topics.join(' '),
      3
    );

    let similarityScore = 0;

    if (context.historicalCrises.length > 0) {
      // Calcula similaridade média com crises passadas
      const highRiskCrises = context.historicalCrises.filter(
        (c) => c.riskLevel === 'high' || c.riskLevel === 'critical'
      );
      similarityScore = highRiskCrises.length / Math.max(1, context.historicalCrises.length);
    }

    return {
      name: 'historical_similarity',
      weight: similarityScore * RISK_WEIGHTS.historicalSimilarity,
      description: `${context.historicalCrises.length} crises históricas similares encontradas`,
    };
  }

  /**
   * Avalia fator de engajamento: alta velocidade de engajamento = maior risco.
   */
  private evaluateEngagementFactor(analysis: AnalysisResult): RiskFactor {
    // Para MVP, simula baseado no score de relevância
    // Em produção, calcular velocidade real (menções/hora)
    const engagementVelocity = analysis.relevanceScore;
    return {
      name: 'engagement_velocity',
      weight: engagementVelocity * RISK_WEIGHTS.engagementVelocity * 0.5,
      description: `Velocidade de engajamento estimada: ${(engagementVelocity * 100).toFixed(0)}%`,
    };
  }

  /**
   * Avalia entidades presentes: certas entidades podem indicar maior risco.
   */
  private evaluateEntityFactor(analysis: AnalysisResult): RiskFactor {
    const highRiskEntities = analysis.entities.filter(
      (e) => e.type === 'regulation' || e.type === 'organization'
    );

    // Presença de termos legais/regulatórios aumenta risco
    const entityRiskScore = Math.min(1, highRiskEntities.length * 0.3);

    return {
      name: 'entity_risk',
      weight: entityRiskScore * 0.15,
      description: `${highRiskEntities.length} entidades de alto risco detectadas`,
    };
  }

  /**
   * Calcula score composto ponderado de todos os fatores.
   */
  private calculateCompositeScore(factors: RiskFactor[]): number {
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    // Normaliza para 0-1
    return Math.min(1, Math.max(0, totalWeight));
  }

  /**
   * Classifica o nível de risco baseado no score.
   */
  private classifyRiskLevel(score: number): RiskLevel {
    if (score >= 0.7) return 'critical';
    if (score >= 0.5) return 'high';
    if (score >= 0.25) return 'medium';
    return 'low';
  }

  /**
   * Prediz a probabilidade de propagação da crise.
   * Baseado em: sentimento negativo + score de risco + volume de menções.
   */
  private predictSpread(riskScore: number, analysis: AnalysisResult): number {
    const baseSpread = riskScore * 0.6;
    const sentimentBoost = analysis.sentimentScore < -0.5 ? 0.2 : 0;
    const relevanceBoost = analysis.relevanceScore > 0.7 ? 0.2 : 0;

    return Math.min(1, baseSpread + sentimentBoost + relevanceBoost);
  }

  /**
   * Distribuição dos níveis de risco (para relatório).
   */
  private getRiskDistribution(assessments: RiskAssessment[]): Record<string, number> {
    const dist: Record<string, number> = {};
    for (const a of assessments) {
      dist[a.riskLevel] = (dist[a.riskLevel] || 0) + 1;
    }
    return dist;
  }
}
