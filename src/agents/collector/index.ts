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
   * Gera mencoes contextualizadas baseadas no objetivo real.
   * Extrai entidades do objetivo (empresa, cidade, pessoa, tema)
   * e gera textos relevantes ao contexto.
   */
  private extractContext(query: string): { entity: string; context: string; location: string } {
    // Remove prefixos padrao
    let clean = query.replace(/^(Coletar menções relacionadas a:|Monitorar:|Gerar relatorio:)\s*/i, '').trim();

    // Tenta extrair localizacao (cidade/estado)
    const locationMatch = clean.match(/(?:de|em|do|da)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+(?:de|da|do)\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)?)/);
    const location = locationMatch ? locationMatch[1] : 'Brasil';

    // Tenta extrair entidade principal (antes de "reputacao" ou "monitoramento")
    const entityMatch = clean.match(/(?:reputação\s+(?:da|do|de)\s+)([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s/]+?)(?:\s+(?:em|no|na|para|,)|$)/i);
    const entity = entityMatch ? entityMatch[1].trim() : clean.slice(0, 40);

    // Determina contexto baseado no texto do objetivo
    let context = 'geral';
    if (/\b(reputação|imagem|marca)\b/i.test(clean)) context = 'reputacao';
    else if (/\b(crise|problema|reclamação|denúncia)\b/i.test(clean)) context = 'crise';
    else if (/\b(lançamento|novo|produto|serviço)\b/i.test(clean)) context = 'lancamento';
    else if (/\b(política|governo|prefeitura|gestão)\b/i.test(clean)) context = 'politica';

    return { entity, context, location };
  }

  /**
   * Gera mencoes contextualizadas baseadas no objetivo real.
   * Em producao: substituir por chamadas de API reais (Twitter, Instagram, etc.)
   */
  private async simulateFetch(platform: MediaPlatform, query: string): Promise<Mention[]> {
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));

    const ctx = this.extractContext(query);
    const ent = ctx.entity;
    const loc = ctx.location;

    // Templates contextualizados por plataforma
    const tweetTemplates: string[] = [
      `@cidadão: ${ent} precisa melhorar a comunicação com a população de ${loc}. Transparência já! #reclamação`,
      `@influencer: Acabei de ler o relatório sobre ${ent} em ${loc}. Dados preocupantes. Precisamos fiscalizar!`,
      `@jornalista: ${ent} anuncia novas medidas para ${loc}. Promete resultados em 90 dias. Vamos acompanhar.`,
      `@cidadão: Que vergonha a situação de ${ent} em ${loc}. Cadê as autoridades? #cobrança`,
      `@apoiador: ${ent} está fazendo um ótimo trabalho em ${loc}. Merece reconhecimento! 👍`,
      `@empresa: Parabéns a ${ent} pela iniciativa em ${loc}. Exemplo a ser seguido.`,
      `@ONG: Denúncia: ${ent} está negligenciando ${loc}. Isso é inaceitável! #denúncia`,
      `@jornalista: Fonte revela que ${ent} pode sofrer cortes em ${loc}. Impacto direto na população.`,
    ];

    const instagramTemplates: string[] = [
      `📍 ${loc} | A situação de ${ent} é preocupante. A população merece mais! #reclamação #${loc.replace(/\s/g, '')}`,
      `📸 ${ent} em ${loc} — imagens que circulam nas redes mostram a realidade. compartilhem!`,
      `😡 ＩＳＳＯ Ｅ́ ＵＭＡ ${ent} ${loc}? População revoltada. #vergonha`,
      `✅ ${ent} está transformando ${loc}! Moradores aprovam as mudanças. #progresso`,
      `👀 Quem viu a última publicação de ${ent} sobre ${loc}? Opiniões?`,
      `📍 ${loc} | ${ent} divulga balanço positivo do último trimestre. Números animadores!`,
    ];

    const facebookTemplates: string[] = [
      `Grupo "Moradores de ${loc}" discute a gestão de ${ent}. Participe da enquete!`,
      `Compartilho artigo sobre ${ent} em ${loc}: "Entre promessas e realidade, o que muda?"`,
      `${ent} convida população de ${loc} para audiência pública nesta quinta. Confira!`,
      `Sindicato critica as últimas decisões de ${ent} em ${loc}. Nota oficial divulgada.`,
      `Movimento "${loc} Melhor" apoia as reformas propostas por ${ent}. Junte-se a nós!`,
    ];

    const linkedinTemplates: string[] = [
      `Análise: O impacto das políticas de ${ent} em ${loc} — um estudo de caso.`,
      `${ent} publica relatório de transparência referente a ${loc}. Acesso aos dados.`,
      `Parceria entre ${ent} e iniciativa privada viabiliza projeto inédito em ${loc}.`,
      `Cargo aberto: ${ent} busca diretor de comunicação para atuação em ${loc}.`,
      `Artigo: "Lições aprendidas com a gestão de ${ent} em ${loc}" por especialista convidado.`,
    ];

    const newsTemplates: string[] = [
      `${ent} anuncia investimento histórico em ${loc}. Obras começam no próximo mês.`,
      `Reportagem especial: Os bastidores da crise entre ${ent} e a população de ${loc}.`,
      `Exclusivo: Dados obtidos mostram irregularidades na gestão de ${ent} em ${loc}.`,
      `${ent} se pronuncia sobre polêmica envolvendo contrato em ${loc}. Leia a nota na íntegra.`,
      `Pesquisa de opinião revela que 67% dos moradores de ${loc} aprovam gestão de ${ent}.`,
    ];

    const templatesByPlatform: Record<MediaPlatform, string[]> = {
      twitter: tweetTemplates, instagram: instagramTemplates, facebook: facebookTemplates,
      linkedin: linkedinTemplates, news_portal: newsTemplates,
      tiktok: [], youtube: [], blog: [], forum: [], radio: [], tv: [], whatsapp: [], other: [],
    };

    const templates = templatesByPlatform[platform] || [];
    // Seleciona 2-4 templates aleatorios
    const count = Math.min(templates.length, 2 + Math.floor(Math.random() * 3));
    const shuffled = [...templates].sort(() => Math.random() - 0.5).slice(0, count);

    const domainMap: Record<string, string> = {
      twitter: 'x.com', instagram: 'instagram.com', facebook: 'facebook.com',
      linkedin: 'linkedin.com', news_portal: 'g1.globo.com',
      tiktok: 'tiktok.com', youtube: 'youtube.com',
    };

    return shuffled.map((template) => {
      const domain = domainMap[platform] || platform + '.com';
      const shortId = generateId().slice(0, 8);
      const platformPath = platform === 'twitter' ? '/user/status/' :
                          platform === 'instagram' ? '/p/' :
                          platform === 'facebook' ? '/groups/feed/' :
                          platform === 'linkedin' ? '/feed/update/' :
                          platform === 'news_portal' ? '/mg/belo-horizonte/noticia/' :
                          '/post/';

      const authorNames = ['Ana Silva', 'Carlos Oliveira', 'Maria Santos', 'Joao Costa', 'Pedro Pereira', 'Lucia Mendes', 'Rafael Souza', 'Juliana Lima', 'Fernando Alves', 'Beatriz Rocha'];
      const twitterHandles = ['cidadao_mg', 'bh_observa', 'jornalista_mg', 'ativista_mg', 'politica_br', 'morador_bh', 'transparencia_br', 'opiniao_publica'];

      // Autores reais por plataforma
      let author: string;
      let verified = false;
      if (platform === 'twitter') {
        author = '@' + twitterHandles[Math.floor(Math.random() * twitterHandles.length)];
      } else if (platform === 'linkedin') {
        author = authorNames[Math.floor(Math.random() * authorNames.length)] + ' | ' + ['Jornalista', 'Analista Politico', 'Gestor Publico', 'Advogado', 'Professor'][Math.floor(Math.random() * 5)];
        verified = true;
      } else if (platform === 'news_portal') {
        author = authorNames[Math.floor(Math.random() * authorNames.length)];
        verified = true;
      } else if (platform === 'instagram') {
        author = authorNames[Math.floor(Math.random() * authorNames.length)].toLowerCase().replace(' ', '_');
      } else {
        author = authorNames[Math.floor(Math.random() * authorNames.length)];
      }

      return {
        id: generateId(),
        source: {
          platform,
          timestamp: new Date(Date.now() - Math.random() * 86400000),
          language: 'pt-BR',
          region: loc.includes('MG') || loc.includes('Belo Horizonte') ? 'MG' :
                 loc.includes('SP') || loc.includes('Sao Paulo') ? 'SP' :
                 loc.includes('RJ') || loc.includes('Rio de Janeiro') ? 'RJ' : 'BR',
          url: 'https://' + domain + platformPath + shortId,
          author,
          engagement: {
            likes: Math.floor(Math.random() * 1500) + 50,
            shares: Math.floor(Math.random() * 300) + 10,
            comments: Math.floor(Math.random() * 100) + 5,
            views: platform === 'instagram' || platform === 'youtube' ? Math.floor(Math.random() * 50000) + 1000 : undefined,
          },
        } as SourceMetadata,
        rawContent: template + (verified ? ' ✓' : ''),
        collectedAt: now(),
      };
    });
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
