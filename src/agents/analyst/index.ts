/**
 * Analyst Agent — Processamento de Linguagem Natural (NLP)
 *
 * Responsabilidades:
 * - Analisar sentimento de menções (português e português regional)
 * - Extrair entidades nomeadas (pessoas, orgs, locais, eventos)
 * - Classificar relevância e tópicos
 * - Sumarizar conteúdo automaticamente
 * - Tradução automática quando necessário
 *
 * Para MVP, usa análise baseada em regras/lexicon.
 * Em produção, substituir por LLMs (GPT-4, Gemini) para
 * análise semântica profunda.
 */

import { BaseAgent } from '../base-agent';
import {
  Task,
  TaskResult,
  AgentType,
  Mention,
  AnalysisResult,
  SentimentLabel,
  ExtractedEntity,
} from '../../types';
import { generateId, now, logger } from '../../utils';

// Lexicon de sentimento em português (simplificado para MVP)
const SENTIMENT_LEXICON: Record<string, SentimentLabel> = {
  // Positivo
  excelente: 'very_positive',
  ótimo: 'very_positive',
  maravilhoso: 'very_positive',
  incrível: 'very_positive',
  parabéns: 'very_positive',
  bom: 'positive',
  positiva: 'positive',
  positivo: 'positive',
  apoio: 'positive',
  apoio_total: 'very_positive',
  desenvolvimento: 'positive',
  progresso: 'positive',
  sucesso: 'very_positive',
  transformar: 'positive',
  geração: 'positive',
  empregos: 'positive',
  // Negativo
  péssimo: 'very_negative',
  horrível: 'very_negative',
  preocupante: 'negative',
  preocupado: 'negative',
  promessa: 'negative',
  transparência: 'positive',
  desafios: 'negative',
  impacto: 'negative',
  viabilidade: 'negative',
  dúvidas: 'negative',
};

// Stopwords em português
const STOPWORDS = new Set([
  'a', 'ao', 'aos', 'aquela', 'aquelas', 'aquele', 'aqueles',
  'com', 'como', 'da', 'das', 'de', 'dela', 'delas', 'dele', 'deles',
  'do', 'dos', 'e', 'é', 'em', 'entre', 'essa', 'essas', 'esse', 'esses',
  'esta', 'estas', 'este', 'estes', 'eu', 'foi', 'foram', 'mas', 'me',
  'meu', 'meus', 'minha', 'minhas', 'muito', 'na', 'não', 'nas', 'nem',
  'no', 'nos', 'nós', 'nossa', 'nossas', 'nosso', 'nossos', 'num', 'numa',
  'o', 'os', 'ou', 'para', 'pela', 'pelas', 'pelo', 'pelos', 'por', 'que',
  'se', 'sem', 'seus', 'sua', 'suas', 'teu', 'teus', 'tu', 'um', 'uma',
  'umas', 'uns', 'vai', 'vamos',
]);

// Padrões de entidades (simplificado)
const ENTITY_PATTERNS: Array<{ regex: RegExp; type: ExtractedEntity['type'] }> = [
  { regex: /\b[A-Z][a-záéíóú]+(\s[A-Z][a-záéíóú]+)+\b/g, type: 'person' },
  { regex: /\b(Prefeitura|Governo|Secretaria|Ministério|Câmara|Assembléia)\s\w+/g, type: 'organization' },
  { regex: /\b(PBH|BH|MG)\b/g, type: 'organization' },
  { regex: /\b(Belo Horizonte|São Paulo|Rio de Janeiro|Brasília|Salvador|Recife|Porto Alegre|Curitiba|Manaus|Fortaleza)\b/gi, type: 'location' },
  { regex: /\b(Lei|Decreto|Portaria|Edital|PL)\s\d+/g, type: 'regulation' },
];

export class AnalystAgent extends BaseAgent {
  readonly type: AgentType = 'analyst';

  constructor() {
    super();
    logger.info('Analyst Agent initialized');
  }

  async execute(task: Task): Promise<TaskResult> {
    this.logStart(task);

    try {
      // Obtém menções do resultado da tarefa anterior (Collector)
      const mentions = this.extractMentions(task);

      if (!mentions || mentions.length === 0) {
        return this.success(
          { analyses: [] },
          'No mentions to analyze',
          { totalAnalyzed: 0 }
        );
      }

      const analyses = mentions.map((mention) => this.analyzeMention(mention));

      logger.info({
        totalAnalyzed: analyses.length,
        sentimentDistribution: this.getSentimentDistribution(analyses),
      }, 'Analyst: analysis completed');

      return this.success(
        { analyses },
        `Analyzed ${analyses.length} mentions with sentiment distribution`,
        {
          totalAnalyzed: analyses.length,
          positiveCount: analyses.filter((a) => a.sentiment === 'positive' || a.sentiment === 'very_positive').length,
          negativeCount: analyses.filter((a) => a.sentiment === 'negative' || a.sentiment === 'very_negative').length,
          neutralCount: analyses.filter((a) => a.sentiment === 'neutral').length,
        }
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return this.failure(`Analysis failed: ${msg}`);
    }
  }

  /**
   * Extrai menções do contexto da tarefa.
   * Primeiro tenta dos accumulatedResults (encadeamento do orchestrator),
   * depois do próprio resultado, e por fim usa simulação.
   */
  private extractMentions(task: Task): Mention[] {
    // 1. Tenta dos resultados acumulados do orchestrator
    const accumulated = task.metadata?.accumulatedResults as Record<string, unknown> | undefined;
    if (accumulated?.mentions && Array.isArray(accumulated.mentions)) {
      logger.info({ mentionCount: accumulated.mentions.length }, 'Analyst: using mentions from accumulated results');
      return accumulated.mentions as Mention[];
    }

    // 2. Tenta do próprio resultado (se já foi populado)
    if (task.result?.data && typeof task.result.data === 'object') {
      const data = task.result.data as { mentions?: Mention[] };
      if (data.mentions) {
        return data.mentions;
      }
    }

    // 3. Para demonstração/MVP, retorna menções simuladas
    return this.simulateMentions(task.objective);
  }

  /**
   * Analisa uma menção completa: sentimento + entidades + relevância.
   */
  private analyzeMention(mention: Mention): AnalysisResult {
    const sentiment = this.analyzeSentiment(mention.rawContent);
    const entities = this.extractEntities(mention.rawContent);
    const topics = this.extractTopics(mention.rawContent);
    const summary = this.generateSummary(mention.rawContent);
    const relevanceScore = this.calculateRelevance(mention, topics);

    return {
      mentionId: mention.id,
      sentiment: sentiment.label,
      sentimentScore: sentiment.score,
      topics,
      entities,
      summary,
      isRelevant: relevanceScore > 0.3,
      relevanceScore,
      analyzedAt: now(),
    };
  }

  /**
   * Análise de sentimento baseada em léxico de palavras.
   * Em produção: LLM (GPT-4/Gemini) para análise semântica contextual.
   */
  private analyzeSentiment(text: string): { label: SentimentLabel; score: number } {
    const words = text.toLowerCase().split(/\s+/);
    let sentimentSum = 0;
    let matchedWords = 0;

    for (const word of words) {
      // Limpa pontuação
      const cleanWord = word.replace(/[^a-záéíóúâêôãõçàèìòùäëïöüñ]/g, '');
      if (!cleanWord) continue;

      const label = SENTIMENT_LEXICON[cleanWord];
      if (label) {
        matchedWords++;
        switch (label) {
          case 'very_positive': sentimentSum += 1.0; break;
          case 'positive': sentimentSum += 0.5; break;
          case 'negative': sentimentSum -= 0.5; break;
          case 'very_negative': sentimentSum -= 1.0; break;
          default: break;
        }
      }
    }

    const score = matchedWords > 0 ? sentimentSum / Math.sqrt(matchedWords) : 0;
    const clamped = Math.max(-1, Math.min(1, score));

    let label: SentimentLabel;
    if (clamped <= -0.6) label = 'very_negative';
    else if (clamped <= -0.2) label = 'negative';
    else if (clamped < 0.2) label = 'neutral';
    else if (clamped < 0.6) label = 'positive';
    else label = 'very_positive';

    return { label, score: clamped };
  }

  /**
   * Extrai entidades nomeadas usando padrões regex.
   * Em produção: NER baseado em LLM ou biblioteca especializada (spaCy, Stanford NER).
   */
  private extractEntities(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const seen = new Set<string>();

    for (const { regex, type } of ENTITY_PATTERNS) {
      const matches = text.matchAll(regex);
      for (const match of matches) {
        const name = match[0].trim();
        if (name.length > 2 && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          entities.push({
            name,
            type,
            confidence: 0.7 + Math.random() * 0.25, // Simulado; em produção usar score real
          });
        }
      }
    }

    return entities;
  }

  /**
   * Extrai tópicos relevantes do texto removendo stopwords.
   */
  private extractTopics(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const topics = words
      .map((w) => w.replace(/[^a-záéíóúâêôãõçàèìòùäëïöüñ0-9]/g, ''))
      .filter((w) => w.length > 3 && !STOPWORDS.has(w));

    return [...new Set(topics)].slice(0, 10);
  }

  /**
   * Gera um resumo simples (primeira sentença ou primeiros N caracteres).
   * Em produção: sumarização via LLM.
   */
  private generateSummary(text: string): string {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length > 0) {
      return sentences[0].trim();
    }
    return text.slice(0, 100).trim() + (text.length > 100 ? '...' : '');
  }

  /**
   * Calcula pontuação de relevância baseada em engajamento e entidades.
   */
  private calculateRelevance(mention: Mention, topics: string[]): number {
    let score = 0.3; // Score base

    // Bônus por engajamento
    if (mention.source.engagement) {
      const { likes, shares, comments } = mention.source.engagement;
      const totalEngagement = likes + shares * 2 + comments * 3;
      score += Math.min(0.4, totalEngagement / 1000);
    }

    // Bônus por entidades encontradas (indica conteúdo informativo)
    score += Math.min(0.3, topics.length * 0.05);

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Distribuição de sentimentos (para relatório).
   */
  private getSentimentDistribution(analyses: AnalysisResult[]): Record<string, number> {
    const dist: Record<string, number> = {};
    for (const a of analyses) {
      dist[a.sentiment] = (dist[a.sentiment] || 0) + 1;
    }
    return dist;
  }

  /**
   * Retorna array vazio - dados simulados sao BLOQUEADOS pelo barramento de validacao.
   * Apenas conectores com APIs reais fornecem mencoes.
   */
  private simulateMentions(objective: string): Mention[] {
    return [];
  }
}
