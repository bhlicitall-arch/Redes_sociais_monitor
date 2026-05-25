/**
 * Collector Agent — Coleta Massiva e Inteligente de Dados
 *
 * Responsabilidades:
 * - Coletar menções em múltiplas plataformas (redes sociais, portais, RSS, etc.)
 * - Gerenciar conectores de forma paralela e resiliente
 * - Filtrar duplicatas e conteúdo irrelevante
 * - Enriquecer dados brutos com metadados da fonte
 *
 * Conectores planejados:
 * - Twitter/X API v2
 * - Instagram Graph API
 * - Facebook Graph API
 * - LinkedIn API
 * - TikTok API
 * - RSS Feeds (portais de notícias)
 * - Web Scraping (sites governamentais)
 * - YouTube Data API
 */

import { BaseAgent } from '../base-agent';
import {
  Task,
  TaskResult,
  AgentType,
  Mention,
  MediaPlatform,
  SourceMetadata,
} from '../../types';
import { generateId, now, logger } from '../../utils';

// Interface para conectores de fonte
interface ISourceConnector {
  platform: MediaPlatform;
  fetch(query: string): Promise<Mention[]>;
}

export class CollectorAgent extends BaseAgent {
  readonly type: AgentType = 'collector';
  private connectors: Map<MediaPlatform, ISourceConnector> = new Map();
  private collectedMentions: Mention[] = [];

  constructor() {
    super();
    this.registerBuiltinConnectors();
    logger.info('Collector Agent initialized with built-in connectors');
  }

  /**
   * Registra conectores nativos para simulação.
   * Em produção, substituir por conectores reais (API keys).
   */
  private registerBuiltinConnectors(): void {
    // Simula conector de mídias sociais
    this.registerConnector({
      platform: 'twitter',
      fetch: async (query: string) => this.simulateFetch('twitter', query),
    });

    this.registerConnector({
      platform: 'instagram',
      fetch: async (query: string) => this.simulateFetch('instagram', query),
    });

    this.registerConnector({
      platform: 'facebook',
      fetch: async (query: string) => this.simulateFetch('facebook', query),
    });

    this.registerConnector({
      platform: 'linkedin',
      fetch: async (query: string) => this.simulateFetch('linkedin', query),
    });

    this.registerConnector({
      platform: 'news_portal',
      fetch: async (query: string) => this.simulateFetch('news_portal', query),
    });
  }

  /**
   * Registra um conector para uma plataforma.
   */
  registerConnector(connector: ISourceConnector): void {
    this.connectors.set(connector.platform, connector);
    logger.info({ platform: connector.platform }, 'Connector registered');
  }

  /**
   * Executa a tarefa de coleta.
   */
  async execute(task: Task): Promise<TaskResult> {
    this.logStart(task);
    this.collectedMentions = [];

    try {
      const platforms = Array.from(this.connectors.keys());
      const query = task.objective;

      logger.info({ platforms, query }, 'Collector: fetching from all platforms');

      // Coleta de todas as plataformas em paralelo
      const results = await Promise.allSettled(
        platforms.map((platform) => this.fetchFromPlatform(platform, query))
      );

      // Processa resultados, ignorando falhas individuais
      for (const result of results) {
        if (result.status === 'fulfilled') {
          this.collectedMentions.push(...result.value);
        } else {
          logger.error({ error: result.reason }, 'Collector: platform fetch failed');
        }
      }

      // Deduplica por conteúdo similar
      const uniqueMentions = this.deduplicate(this.collectedMentions);

      logger.info({
        totalCollected: this.collectedMentions.length,
        uniqueCount: uniqueMentions.length,
      }, 'Collector: collection completed');

      return this.success(
        { mentions: uniqueMentions },
        `Collected ${uniqueMentions.length} unique mentions across ${platforms.length} platforms`,
        { totalCollected: this.collectedMentions.length, uniqueCount: uniqueMentions.length }
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error({ error: msg }, 'Collector: task failed');
      return this.failure(`Collection failed: ${msg}`);
    }
  }

  /**
   * Coleta menções de uma plataforma específica.
   */
  private async fetchFromPlatform(platform: MediaPlatform, query: string): Promise<Mention[]> {
    const connector = this.connectors.get(platform);
    if (!connector) {
      logger.warn({ platform }, 'Collector: no connector for platform');
      return [];
    }

    return connector.fetch(query);
  }

  /**
   * Simula coleta de dados (para MVP/demonstração).
   * Em produção, substituir por chamadas de API reais.
   */
  private async simulateFetch(platform: MediaPlatform, query: string): Promise<Mention[]> {
    // Simula latência de rede
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));

    const sampleTexts: Record<MediaPlatform, string[]> = {
      twitter: [
        `${query} — A nova iniciativa vai transformar o turismo na região!`,
        `${query} finalmente saindo do papel. Parabéns ao governo!`,
        `Preocupante o andamento do ${query}. Precisamos de mais transparência.`,
        `${query}: mais uma promessa que não sai do lugar?`,
        `Excelente notícia! ${query} vai gerar empregos e desenvolvimento.`,
      ],
      instagram: [
        `Que lugar incrível! ${query} merece toda atenção 😍`,
        `${query} - fotos reais do andamento das obras`,
        `Quem já visitou o ${query}? Recomendam?`,
        `Novo ponto turístico imperdível! ${query} de tirar o fôlego 📸`,
      ],
      facebook: [
        `Grupo de moradores debate impactos do ${query} na comunidade local.`,
        `Compartilho artigo sobre os desafios do ${query} na nossa região.`,
        `Apoio total ao ${query}! Vamos divulgar para todos!`,
      ],
      linkedin: [
        `Análise: O impacto econômico do ${query} para o turismo regional.`,
        `Parceria público-privada viabiliza o ${query}. Saiba mais.`,
        `${query}: estudo de caso em desenvolvimento turístico sustentável.`,
      ],
      news_portal: [
        `Governo anuncia investimento recorde no ${query}.`,
        `${query}: obras avançam e previsão de conclusão é para o próximo semestre.`,
        `Especialistas debatem a viabilidade do ${query} em seminário hoje.`,
      ],
      tiktok: [],
      youtube: [],
      blog: [],
      forum: [],
      radio: [],
      tv: [],
      whatsapp: [],
      other: [],
    };

    const texts = sampleTexts[platform] || [];
    return texts.map((content) => ({
      id: generateId(),
      source: {
        platform,
        timestamp: new Date(Date.now() - Math.random() * 86400000), // até 24h atrás
        language: 'pt-BR',
        region: 'CE',
        url: `https://${platform}.com/sample/${generateId().slice(0, 8)}`,
        author: `user_${platform}_${Math.floor(Math.random() * 1000)}`,
        engagement: {
          likes: Math.floor(Math.random() * 500),
          shares: Math.floor(Math.random() * 100),
          comments: Math.floor(Math.random() * 50),
        },
      } as SourceMetadata,
      rawContent: content,
      collectedAt: now(),
    }));
  }

  /**
   * Deduplica menções baseado em similaridade do conteúdo.
   */
  private deduplicate(mentions: Mention[]): Mention[] {
    const seen = new Set<string>();
    return mentions.filter((m) => {
      // Usa uma fingerprint simples: primeiros 50 chars + plataforma
      const fingerprint = `${m.source.platform}:${m.rawContent.slice(0, 50)}`;
      if (seen.has(fingerprint)) {
        return false;
      }
      seen.add(fingerprint);
      return true;
    });
  }

  /**
   * Retorna as menções coletadas na última execução.
   */
  getLastCollected(): Mention[] {
    return [...this.collectedMentions];
  }
}
