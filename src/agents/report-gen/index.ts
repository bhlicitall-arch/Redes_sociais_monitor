/**
 * Report Gen Agent — Compilação de Relatórios e Dashboards
 *
 * Responsabilidades:
 * - Compilar dados em relatórios profissionais (Markdown/PDF)
 * - Gerar visualizações dinâmicas de dados
 * - Produzir dashboards executivos
 * - Incluir recomendações acionáveis baseadas nos dados
 * - Suporte a branding personalizado (logo, cores)
 *
 * Formatos suportados:
 * - Markdown (padrão)
 * - JSON (para consumo por APIs)
 * - HTML (para visualização em navegador)
 */

import { BaseAgent } from '../base-agent';
import {
  Task,
  TaskResult,
  AgentType,
  ReportConfig,
  ReportSection,
  AnalysisResult,
  RiskAssessment,
  Mention,
} from '../../types';
import { now, logger } from '../../utils';
import { memoryManager } from '../../memory';

export class ReportGenAgent extends BaseAgent {
  readonly type: AgentType = 'report_gen';

  constructor() {
    super();
    logger.info('Report Gen Agent initialized');
  }

  async execute(task: Task): Promise<TaskResult> {
    this.logStart(task);

    try {
      // Extrai dados consolidados do contexto da tarefa
      const context = this.extractTaskContext(task);

      // Gera o relatório em Markdown
      const markdownReport = this.generateMarkdownReport(
        task.objective,
        context
      );

      // Armazena relatório na memória relacional
      const reportId = memoryManager.relational.storeReport({
        title: task.objective,
        generatedAt: now(),
        format: 'markdown',
        content: markdownReport,
      });

      logger.info({ reportId, reportLength: markdownReport.length }, 'Report Gen: report generated');

      return this.success(
        {
          reportId,
          format: 'markdown',
          content: markdownReport,
        },
        `Relatório gerado com sucesso (${markdownReport.length} caracteres)`,
        { reportLength: markdownReport.length, sectionsCount: context.analyses?.length || 0 }
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return this.failure(`Report generation failed: ${msg}`);
    }
  }

  /**
   * Extrai dados consolidados do contexto da tarefa e seus resultados anteriores.
   * Primeiro tenta dos accumulatedResults (encadeamento do orchestrator),
   * depois verifica subtarefas.
   */
  private extractTaskContext(task: Task): {
    analyses?: AnalysisResult[];
    assessments?: RiskAssessment[];
    objective: string;
  } {
    const context: {
      analyses?: AnalysisResult[];
      assessments?: RiskAssessment[];
      objective: string;
    } = {
      objective: task.objective,
    };

    // 1. Tenta dos resultados acumulados do orchestrator (contém dados de TODOS os agentes anteriores)
    const accumulated = task.metadata?.accumulatedResults as Record<string, unknown> | undefined;
    if (accumulated) {
      if (Array.isArray(accumulated.analyses)) {
        context.analyses = accumulated.analyses as AnalysisResult[];
      }
      if (Array.isArray(accumulated.assessments)) {
        context.assessments = accumulated.assessments as RiskAssessment[];
      }
      logger.info({
        analysesCount: context.analyses?.length || 0,
        assessmentsCount: context.assessments?.length || 0,
      }, 'ReportGen: using data from accumulated results');
    }

    // 2. Busca em subtarefas (fallback para execução paralela)
    if ((!context.analyses || context.analyses.length === 0) && task.subtasks) {
      for (const subtask of task.subtasks) {
        if (subtask.result?.data && typeof subtask.result.data === 'object') {
          const data = subtask.result.data as Record<string, unknown>;

          if (subtask.assignedAgent === 'analyst' && Array.isArray(data.analyses)) {
            context.analyses = data.analyses as AnalysisResult[];
          }
          if (subtask.assignedAgent === 'risk_detector' && Array.isArray(data.assessments)) {
            context.assessments = data.assessments as RiskAssessment[];
          }
        }
      }
    }

    return context;
  }

  /**
   * Gera relatório completo em formato Markdown.
   */
  private generateMarkdownReport(
    title: string,
    context: {
      analyses?: AnalysisResult[];
      assessments?: RiskAssessment[];
      objective: string;
    }
  ): string {
    const lines: string[] = [];
    const nowDate = now().toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // === HEADER ===
    lines.push(`# 📊 Relatório de Monitoramento\n`);
    lines.push(`**Plataforma Agentic de Monitoramento Superior**\n`);
    lines.push(`> Gerado em: ${nowDate}\n`);
    lines.push(`> Objetivo: ${context.objective}\n`);
    lines.push(`---\n`);

    // === RESUMO EXECUTIVO ===
    lines.push(`## 📋 Resumo Executivo\n`);

    const totalAnalyses = context.analyses?.length || 0;
    const highRiskItems = context.assessments?.filter(
      (a) => a.riskLevel === 'high' || a.riskLevel === 'critical'
    ).length || 0;
    const avgSentiment = context.analyses
      ? context.analyses.reduce((s, a) => s + a.sentimentScore, 0) / Math.max(1, totalAnalyses)
      : 0;

    lines.push(`| Indicador | Valor |`);
    lines.push(`|-----------|-------|`);
    lines.push(`| Total de Menções Analisadas | ${totalAnalyses} |`);
    lines.push(`| Sentimento Médio | ${avgSentiment.toFixed(3)} |`);
    lines.push(`| Itens de Alto Risco | ${highRiskItems} |`);
    lines.push(`| Período da Análise | Últimas 24 horas |`);
    lines.push(`\n`);

    // === ANÁLISE DE SENTIMENTO ===
    if (context.analyses && context.analyses.length > 0) {
      lines.push(`## 🎯 Análise de Sentimento\n`);

      const sentimentDist: Record<string, number> = {};
      for (const a of context.analyses) {
        sentimentDist[a.sentiment] = (sentimentDist[a.sentiment] || 0) + 1;
      }

      lines.push(`| Sentimento | Quantidade |`);
      lines.push(`|------------|-----------|`);
      for (const [sentiment, count] of Object.entries(sentimentDist)) {
        const emoji =
          sentiment === 'very_positive' ? '🟢' :
          sentiment === 'positive' ? '💚' :
          sentiment === 'neutral' ? '⚪' :
          sentiment === 'negative' ? '🟠' :
          sentiment === 'very_negative' ? '🔴' : '⚪';
        lines.push(`| ${emoji} ${sentiment} | ${count} |`);
      }
      lines.push(`\n`);

      // Menções mais relevantes
      lines.push(`### Principais Menções\n`);
      const topMentions = context.analyses
        .filter((a) => a.isRelevant)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 5);

      for (const mention of topMentions) {
        const sentimentEmoji =
          mention.sentimentScore > 0.5 ? '😊' :
          mention.sentimentScore < -0.5 ? '😟' : '😐';
        lines.push(`- ${sentimentEmoji} **Score: ${(mention.sentimentScore * 100).toFixed(0)}%** | "${mention.summary}"\n`);
        if (mention.topics.length > 0) {
          lines.push(`  *Tópicos: ${mention.topics.slice(0, 5).join(', ')}*\n`);
        }
      }
      lines.push(`\n`);
    }

    // === AVALIAÇÃO DE RISCO ===
    if (context.assessments && context.assessments.length > 0) {
      lines.push(`## ⚠️ Avaliação de Risco\n`);

      // Itens de alto risco
      const highRisk = context.assessments.filter(
        (a) => a.riskLevel === 'high' || a.riskLevel === 'critical'
      );

      if (highRisk.length > 0) {
        lines.push(`### 🔴 Alertas de Alto Risco\n`);
        for (const risk of highRisk) {
          lines.push(`- **Nível: ${risk.riskLevel.toUpperCase()}** | Score: ${(risk.riskScore * 100).toFixed(0)}% | Propagação prevista: ${(risk.predictedSpread! * 100).toFixed(0)}%\n`);
          lines.push(`  *Fatores contribuintes:*\n`);
          for (const factor of risk.contributingFactors) {
            lines.push(`    - ${factor.name}: peso ${factor.weight.toFixed(3)} — ${factor.description}\n`);
          }
        }
        lines.push(`\n`);
      }

      // Distribuição de risco
      lines.push(`### Distribuição de Risco\n`);
      const riskDist = this.getRiskDistribution(context.assessments);
      lines.push(`| Nível | Quantidade |`);
      lines.push(`|-------|-----------|`);
      for (const [level, count] of Object.entries(riskDist)) {
        const emoji =
          level === 'critical' ? '🔴' :
          level === 'high' ? '🟠' :
          level === 'medium' ? '🟡' : '🟢';
        lines.push(`| ${emoji} ${level} | ${count} |`);
      }
      lines.push(`\n`);
    }

    // === RECOMENDAÇÕES ===
    lines.push(`## 💡 Recomendações\n`);

    if (highRiskItems > 0) {
      lines.push(`1. **🚨 Ação Imediata**: ${highRiskItems} itens de alto risco detectados. Recomenda-se acionar o Crisis Bot para protocolo de resposta.\n`);
      lines.push(`2. **📢 Comunicação**: Preparar nota oficial para esclarecimento dos pontos levantados.\n`);
      lines.push(`3. **📊 Monitoramento Intensificado**: Aumentar frequência de coleta para detectar escalada da crise.\n`);
    } else {
      lines.push(`1. **✅ Cenário Estável**: Nenhum item de alto risco detectado. Manter monitoramento regular.\n`);
      lines.push(`2. **📈 Aproveitar Momento Positivo**: Se sentimento estiver positivo, intensificar divulgação.\n`);
      lines.push(`3. **🔄 Ciclo de Aprendizado**: Alimentar memória com os dados coletados para melhorar detecções futuras.\n`);
    }
    lines.push(`\n`);

    // === FOOTER ===
    lines.push(`---\n`);
    lines.push(`*Relatório gerado automaticamente pela Plataforma Agentic de Monitoramento Superior*\n`);
    lines.push(`*SETUR/CE — Secretaria do Turismo do Estado do Ceará*\n`);

    return lines.join('');
  }

  /**
   * Distribuição de risco (para exibição no relatório).
   */
  private getRiskDistribution(assessments: RiskAssessment[]): Record<string, number> {
    const dist: Record<string, number> = {};
    for (const a of assessments) {
      dist[a.riskLevel] = (dist[a.riskLevel] || 0) + 1;
    }
    return dist;
  }

  /**
   * Gera o relatório em formato JSON (para consumo por API/dashboard).
   */
  generateJSONReport(
    title: string,
    analyses: AnalysisResult[],
    assessments: RiskAssessment[]
  ): string {
    const report = {
      title,
      generatedAt: now().toISOString(),
      platform: 'Plataforma Agentic de Monitoramento Superior',
      summary: {
        totalMentions: analyses.length,
        averageSentiment: analyses.reduce((s, a) => s + a.sentimentScore, 0) / Math.max(1, analyses.length),
        highRiskCount: assessments.filter((a) => a.riskLevel === 'high' || a.riskLevel === 'critical').length,
      },
      analyses: analyses.map((a) => ({
        mentionId: a.mentionId,
        sentiment: a.sentiment,
        sentimentScore: a.sentimentScore,
        topics: a.topics,
        entities: a.entities,
        relevanceScore: a.relevanceScore,
      })),
      riskAssessments: assessments.map((a) => ({
        mentionId: a.mentionId,
        riskLevel: a.riskLevel,
        riskScore: a.riskScore,
        factors: a.contributingFactors,
        predictedSpread: a.predictedSpread,
      })),
    };

    return JSON.stringify(report, null, 2);
  }
}
