/**
 * Report Gen Agent — Relatórios Analíticos Completos
 *
 * Gera relatórios com:
 * - Menções reais (autor, texto, plataforma, link, engajamento)
 * - Análise de sentimento por menção
 * - Distribuição por plataforma
 * - Avaliação de risco detalhada
 * - Recomendações acionáveis
 * - Exportação Markdown + JSON + PDF
 */

import { BaseAgent } from '../base-agent';
import {
  Task, TaskResult, AgentType, AnalysisResult, RiskAssessment, Mention,
} from '../../types';
import { now, logger, generateId } from '../../utils';
import { memoryManager } from '../../memory';
import { getDb } from '../../db';

const PLATFORM_EMOJIS: Record<string, string> = {
  twitter: '🐦', instagram: '📸', facebook: '👍', linkedin: '💼',
  news_portal: '📰', tiktok: '🎵', youtube: '▶️', blog: '📝',
  forum: '💬', radio: '📻', tv: '📺', whatsapp: '💚',
};

const PLATFORM_NAMES: Record<string, string> = {
  twitter: 'Twitter/X', instagram: 'Instagram', facebook: 'Facebook',
  linkedin: 'LinkedIn', news_portal: 'Portal de Noticias',
  tiktok: 'TikTok', youtube: 'YouTube', blog: 'Blog',
  forum: 'Forum', radio: 'Radio', tv: 'TV', whatsapp: 'WhatsApp',
};

export class ReportGenAgent extends BaseAgent {
  readonly type: AgentType = 'report_gen';

  constructor() { super(); logger.info('Report Gen Agent initialized'); }

  async execute(task: Task): Promise<TaskResult> {
    this.logStart(task);

    try {
      const context = this.extractTaskContext(task);
      const objective = task.objective.replace(/^Gerar relatorio: /i, '').replace(/^Monitorar: /i, '');

      // Busca do banco as menções reais desta task/projeto
      const dbMentions = this.fetchDbMentions(task);
      if (dbMentions.length > 0) {
        context.mentions = dbMentions;
      }

      const markdownReport = this.generateAnalyticReport(objective, context);

      // Persiste no banco
      const db = getDb();
      const reportId = generateId();
      try {
        db.prepare(`
          INSERT INTO reports (id, objective, content_markdown, analyses_count, assessments_count, mentions_count, created_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          reportId, objective, markdownReport,
          context.analyses?.length || 0,
          context.assessments?.length || 0,
          context.mentions?.length || 0,
        );
      } catch { /* table may not exist yet */ }

      logger.info({
        reportId, reportLength: markdownReport.length,
        analyses: context.analyses?.length || 0,
        assessments: context.assessments?.length || 0,
        mentions: context.mentions?.length || 0,
      }, 'Report Gen: analytic report generated');

      return this.success(
        {
          reportId,
          format: 'markdown',
          content: markdownReport,
          metrics: {
            totalMentions: context.mentions?.length || 0,
            totalAnalyses: context.analyses?.length || 0,
            totalAssessments: context.assessments?.length || 0,
            highRiskCount: context.assessments?.filter(a => a.riskLevel === 'high' || a.riskLevel === 'critical').length || 0,
          },
        },
        `Relatorio analitico gerado: ${context.mentions?.length || 0} mencoes, ${context.analyses?.length || 0} analises`,
        {
          mentionsCount: context.mentions?.length || 0,
          analysesCount: context.analyses?.length || 0,
          assessmentsCount: context.assessments?.length || 0,
        }
      );
    } catch (error) {
      return this.failure(`Report generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private fetchDbMentions(task: Task): Mention[] {
    try {
      const db = getDb();
      const projectId = task.metadata?.projectId as string;
      if (projectId) {
        const rows = db.prepare(
          'SELECT * FROM mention_records WHERE project_id = ? ORDER BY collected_at DESC LIMIT 50'
        ).all(projectId) as any[];
        if (rows.length > 0) {
          return rows.map((r: any) => ({
            id: r.id,
            source: {
              platform: r.platform,
              timestamp: new Date(r.collected_at),
              author: r.author,
              url: r.url,
              language: r.language || 'pt-BR',
              engagement: r.engagement ? JSON.parse(r.engagement) : undefined,
            },
            rawContent: r.content,
            collectedAt: new Date(r.collected_at),
          }));
        }
      }
      // Fallback: extrai do accumulatedResults
      const acc = task.metadata?.accumulatedResults as Record<string, unknown> | undefined;
      if (acc?.mentions && Array.isArray(acc.mentions)) {
        return acc.mentions as Mention[];
      }
    } catch { /* no db or table */ }
    return [];
  }

  private extractTaskContext(task: Task): {
    analyses?: AnalysisResult[];
    assessments?: RiskAssessment[];
    mentions?: Mention[];
    objective: string;
  } {
    const ctx: any = { objective: task.objective };
    const acc = task.metadata?.accumulatedResults as Record<string, unknown> | undefined;
    if (acc) {
      if (Array.isArray(acc.analyses)) ctx.analyses = acc.analyses;
      if (Array.isArray(acc.assessments)) ctx.assessments = acc.assessments;
      if (Array.isArray(acc.mentions)) ctx.mentions = acc.mentions;
    }
    if ((!ctx.analyses || ctx.analyses.length === 0) && task.subtasks) {
      for (const st of task.subtasks) {
        const d = st.result?.data as Record<string, unknown> | undefined;
        if (!d) continue;
        if (st.assignedAgent === 'analyst' && Array.isArray(d.analyses)) ctx.analyses = d.analyses;
        if (st.assignedAgent === 'risk_detector' && Array.isArray(d.assessments)) ctx.assessments = d.assessments;
        if (st.assignedAgent === 'collector' && Array.isArray(d.mentions)) ctx.mentions = d.mentions;
      }
    }
    return ctx;
  }

  /**
   * Gera relatório analítico completo em Markdown
   */
  private generateAnalyticReport(
    objective: string,
    ctx: { analyses?: AnalysisResult[]; assessments?: RiskAssessment[]; mentions?: Mention[]; objective: string }
  ): string {
    const lines: string[] = [];
    const generatedAt = now().toLocaleString('pt-BR');

    lines.push(`# 📊 Relatorio Analitico de Monitoramento\n`);
    lines.push(`**Midia Monitor** — *By Techlicense*\n`);
    lines.push(`---\n`);
    lines.push(`**Objetivo:** ${objective}\n`);
    lines.push(`**Gerado em:** ${generatedAt}\n`);
    lines.push(`---\n`);

    // ====== SUMÁRIO EXECUTIVO ======
    lines.push(`## 📋 Resumo Executivo\n`);

    const totalMentions = ctx.mentions?.length || 0;
    const totalAnalyses = ctx.analyses?.length || 0;
    const highRisk = ctx.assessments?.filter(a => a.riskLevel === 'high' || a.riskLevel === 'critical').length || 0;
    const avgSentiment = ctx.analyses && ctx.analyses.length > 0
      ? (ctx.analyses.reduce((s, a) => s + a.sentimentScore, 0) / ctx.analyses.length).toFixed(3)
      : '—';

    lines.push(`| Indicador | Valor |`);
    lines.push(`|-----------|-------|`);
    lines.push(`| Total de Mencoes Coletadas | ${totalMentions} |`);
    lines.push(`| Mencoes Analisadas | ${totalAnalyses} |`);
    lines.push(`| Sentimento Medio | ${avgSentiment} |`);
    lines.push(`| Itens de Alto Risco | ${highRisk} |`);
    lines.push(`| Periodo da Analise | Ultimas 24 horas |`);
    lines.push(``);

    // ====== DISTRIBUIÇÃO POR PLATAFORMA ======
    if (ctx.mentions && ctx.mentions.length > 0) {
      lines.push(`## 🌐 Distribuicao por Plataforma\n`);

      const platformCount: Record<string, number> = {};
      for (const m of ctx.mentions) {
        const p = m.source.platform;
        platformCount[p] = (platformCount[p] || 0) + 1;
      }

      lines.push(`| Plataforma | Quantidade |`);
      lines.push(`|------------|-----------|`);
      for (const [p, count] of Object.entries(platformCount).sort((a, b) => b[1] - a[1])) {
        const emoji = PLATFORM_EMOJIS[p] || '🔗';
        const name = PLATFORM_NAMES[p] || p;
        lines.push(`| ${emoji} ${name} | ${count} |`);
      }
      lines.push(``);

      // ====== MENÇÕES DETALHADAS ======
      lines.push(`## 📝 Mencoes Detalhadas\n`);

      for (let i = 0; i < ctx.mentions.length; i++) {
        const m = ctx.mentions[i];
        const platformEmoji = PLATFORM_EMOJIS[m.source.platform] || '🔗';
        const platformName = PLATFORM_NAMES[m.source.platform] || m.source.platform;
        const sentimento = ctx.analyses?.find(a => a.mentionId === m.id);
        const risco = ctx.assessments?.find(a => a.mentionId === m.id);

        lines.push(`### ${i + 1}. ${platformEmoji} ${platformName}\n`);
        lines.push(`| Campo | Valor |`);
        lines.push(`|-------|-------|`);
        lines.push(`| **Autor** | ${m.source.author || 'Anonimo'} |`);
        lines.push(`| **Data** | ${new Date(m.source.timestamp).toLocaleString('pt-BR')} |`);
        lines.push(`| **Plataforma** | ${platformName} |`);
        if (m.source.url) lines.push(`| **Link** | [Abrir original](${m.source.url}) |`);
        if (m.source.region) lines.push(`| **Regiao** | ${m.source.region} |`);

        // Engajamento
        if (m.source.engagement) {
          const e = m.source.engagement;
          const engDetails = [];
          if (e.likes !== undefined) engDetails.push(`❤️ ${e.likes} curtidas`);
          if (e.comments !== undefined) engDetails.push(`💬 ${e.comments} comentarios`);
          if (e.shares !== undefined) engDetails.push(`🔄 ${e.shares} compartilhamentos`);
          if (e.views !== undefined) engDetails.push(`👁️ ${e.views} visualizacoes`);
          if (engDetails.length > 0) {
            lines.push(`| **Engajamento** | ${engDetails.join(' · ')} |`);
          }
        }

        // Sentimento
        if (sentimento) {
          const sentimentEmoji = sentimento.sentimentScore >= 0.5 ? '😊' :
            sentimento.sentimentScore <= -0.5 ? '😟' : '😐';
          lines.push(`| **Sentimento** | ${sentimentEmoji} ${sentimento.sentiment} (score: ${sentimento.sentimentScore.toFixed(3)}) |`);
          lines.push(`| **Relevancia** | ${(sentimento.relevanceScore * 100).toFixed(0)}% |`);
          if (sentimento.topics.length > 0) {
            lines.push(`| **Topicos** | ${sentimento.topics.slice(0, 8).join(', ')} |`);
          }
          if (sentimento.entities.length > 0) {
            const ents = sentimento.entities.map(e => `${e.name} (${e.type})`).join(', ');
            lines.push(`| **Entidades** | ${ents} |`);
          }
        }

        // Risco
        if (risco) {
          const riskEmoji = risco.riskLevel === 'critical' ? '🚨' :
            risco.riskLevel === 'high' ? '🔴' :
            risco.riskLevel === 'medium' ? '🟡' : '🟢';
          lines.push(`| **Nivel de Risco** | ${riskEmoji} ${risco.riskLevel.toUpperCase()} (${(risco.riskScore * 100).toFixed(0)}%) |`);
          if (risco.predictedSpread !== undefined) {
            lines.push(`| **Propagacao Prevista** | ${(risco.predictedSpread * 100).toFixed(0)}% |`);
          }
        }

        // Conteúdo
        lines.push(``);
        lines.push(`**Conteudo:**`);
        lines.push(``);
        lines.push(`> ${m.rawContent}`);
        lines.push(``);
        lines.push(`---\n`);
      }
    }

    // ====== ANÁLISE DE SENTIMENTO ======
    if (ctx.analyses && ctx.analyses.length > 0) {
      lines.push(`## 🎯 Analise de Sentimento Consolidada\n`);

      const dist: Record<string, number> = {};
      for (const a of ctx.analyses) {
        dist[a.sentiment] = (dist[a.sentiment] || 0) + 1;
      }

      lines.push(`| Sentimento | Quantidade | Porcentagem |`);
      lines.push(`|------------|-----------|-------------|`);
      for (const [s, c] of Object.entries(dist)) {
        const emoji = s === 'very_positive' ? '🟢' : s === 'positive' ? '💚' :
          s === 'neutral' ? '⚪' : s === 'negative' ? '🟠' : '🔴';
        const pct = ((c / ctx.analyses.length) * 100).toFixed(1);
        lines.push(`| ${emoji} ${s} | ${c} | ${pct}% |`);
      }
      lines.push(``);
      lines.push(`**Sentimento Medio Geral:** ${avgSentiment}\n`);
    }

    // ====== AVALIAÇÃO DE RISCO ======
    if (ctx.assessments && ctx.assessments.length > 0) {
      lines.push(`## ⚠️ Avaliacao de Risco\n`);

      const riskDist: Record<string, number> = {};
      for (const a of ctx.assessments) {
        riskDist[a.riskLevel] = (riskDist[a.riskLevel] || 0) + 1;
      }

      lines.push(`| Nivel | Quantidade |`);
      lines.push(`|-------|-----------|`);
      for (const [l, c] of Object.entries(riskDist)) {
        const emoji = l === 'critical' ? '🔴' : l === 'high' ? '🟠' : l === 'medium' ? '🟡' : '🟢';
        lines.push(`| ${emoji} ${l} | ${c} |`);
      }
      lines.push(``);

      const highRiskItems = ctx.assessments.filter(a => a.riskLevel === 'high' || a.riskLevel === 'critical');
      if (highRiskItems.length > 0) {
        lines.push(`### 🚨 Alertas de Alto Risco\n`);
        for (const item of highRiskItems) {
          lines.push(`- **Score:** ${(item.riskScore * 100).toFixed(0)}% | **Propagacao:** ${(item.predictedSpread! * 100).toFixed(0)}%`);
          for (const f of item.contributingFactors.filter(f => f.weight > 0.05)) {
            lines.push(`  - ${f.name}: ${f.description}`);
          }
          lines.push(``);
        }
      }
    }

    // ====== RECOMENDAÇÕES ======
    lines.push(`## 💡 Recomendacoes\n`);

    if (highRisk > 0) {
      lines.push(`1. **🚨 Acao Imediata**: ${highRisk} item(ns) de alto risco detectado(s). Acionar protocolo de resposta.\n`);
      lines.push(`2. **📢 Comunicacao**: Preparar nota oficial para esclarecimento.\n`);
      lines.push(`3. **📊 Monitoramento Intensificado**: Aumentar frequencia de coleta.\n`);
    } else {
      lines.push(`1. **✅ Cenario Estavel**: Nenhum item de alto risco detectado.\n`);
      if (avgSentiment !== '—' && parseFloat(avgSentiment as string) > 0.2) {
        lines.push(`2. **📈 Momento Positivo**: Sentimento medio favoravel (${avgSentiment}). Intensificar divulgacao.\n`);
      }
      lines.push(`2. **🔄 Ciclo de Aprendizado**: Alimentar memoria com dados coletados.\n`);
    }
    lines.push(``);

    // ====== FOOTER ======
    lines.push(`---\n`);
    lines.push(`*Relatorio gerado automaticamente pelo **Midia Monitor** — By Techlicense*\n`);
    lines.push(`*Plataforma Agentic de Monitoramento Superior — SETUR/CE*\n`);

    return lines.join('');
  }
}
