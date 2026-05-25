/**
 * Twitter/X Connector — API v2
 *
 * Docs: https://developer.twitter.com/en/docs/twitter-api/tweets/search/api-reference
 * Precisa de: Bearer Token (free tier: 1500 posts/mes)
 *
 * Modo simulado: quando nao ha credenciais configuradas,
 * gera dados realistas para demonstracao.
 */

import { BaseConnector, FetchOptions } from './base-connector';
import { Mention, MediaPlatform } from '../types';
import { generateId, now, logger } from '../utils';

export class TwitterConnector extends BaseConnector {
  readonly platform: MediaPlatform = 'twitter';
  readonly name = 'Twitter/X API v2';
  readonly hasApi = true;
  readonly requiresAuth = true;

  private bearerToken = '';

  async connect(credentials?: Record<string, string>): Promise<boolean> {
    if (credentials?.bearerToken) {
      this.bearerToken = credentials.bearerToken;
      this.connected = true;
      logger.info('Twitter Connector: autenticado via Bearer Token');
      return true;
    }
    logger.warn('Twitter Connector: sem Bearer Token, modo simulacao');
    this.connected = true; // Modo simulado
    return true;
  }

  async fetch(query: string, options?: FetchOptions): Promise<Mention[]> {
    if (this.bearerToken) {
      return this.fetchReal(query, options);
    }
    return this.fetchSimulated(query, options);
  }

  /**
   * Chamada real a API v2 do Twitter
   * GET /2/tweets/search/recent
   */
  private async fetchReal(query: string, options?: FetchOptions): Promise<Mention[]> {
    try {
      const url = new URL('https://api.twitter.com/2/tweets/search/recent');
      url.searchParams.set('query', query + ' lang:pt -is:retweet');
      url.searchParams.set('max_results', String(options?.limit || 10));
      url.searchParams.set('tweet.fields', 'public_metrics,author_id,created_at,lang,geo');

      const res = await fetch(url.toString(), {
        headers: { Authorization: 'Bearer ' + this.bearerToken },
      });

      if (!res.ok) {
        logger.error({ status: res.status }, 'Twitter API: erro na requisicao');
        return [];
      }

      const data = await res.json() as any;
      return (data.data || []).map((tweet: any) => ({
        id: tweet.id,
        source: this.buildSourceMetadata(
          'twitter',
          '@user_' + (tweet.author_id || 'unknown'),
          'https://x.com/user/status/' + tweet.id,
          options?.region || 'BR',
        ),
        rawContent: tweet.text,
        collectedAt: now(),
      }));
    } catch (error) {
      logger.error({ error }, 'Twitter API: falha na requisicao');
      return [];
    }
  }

  /**
   * Dados simulados para quando nao ha credenciais
   */
  private async fetchSimulated(query: string, options?: FetchOptions): Promise<Mention[]> {
    await new Promise(r => setTimeout(r, 50 + Math.random() * 100));

    const ctx = this.extractContext(query);
    const templates = [
      `@cidadao: A situacao de ${ctx.entity} em ${ctx.loc} e preocupante. Precisamos de acao!`,
      `@influencer: Acabei de ler sobre ${ctx.entity}. Dados preocupantes em ${ctx.loc}.`,
      `@jornalista: ${ctx.entity} anuncia novas medidas para ${ctx.loc}. Promete resultados.`,
      `@apoiador: ${ctx.entity} esta fazendo um bom trabalho em ${ctx.loc}. Merece reconhecimento!`,
      `@critico: ${ctx.entity} precisa melhorar a comunicacao com a populacao de ${ctx.loc}.`,
      `@movimento: Denuncia: ${ctx.entity} esta negligenciando ${ctx.loc}. #atencao`,
    ];

    const count = Math.min(templates.length, options?.limit || 5);
    const shuffled = [...templates].sort(() => Math.random() - 0.5).slice(0, count);

    return shuffled.map(t => ({
      id: generateId(),
      source: {
        platform: 'twitter',
        timestamp: new Date(Date.now() - Math.random() * 86400000),
        language: 'pt-BR',
        region: ctx.region,
        url: 'https://x.com/user/status/' + generateId().slice(0, 8),
        author: '@cidadao_' + Math.floor(Math.random() * 9999),
        engagement: { likes: Math.floor(Math.random() * 500), shares: Math.floor(Math.random() * 100), comments: Math.floor(Math.random() * 50) },
      },
      rawContent: t,
      collectedAt: now(),
    }));
  }

  private extractContext(query: string): { entity: string; loc: string; region: string } {
    let clean = query.replace(/^(Coletar menções relacionadas a:|Monitorar:|Gerar relatorio:)\s*/i, '').trim();
    const locMatch = clean.match(/(?:de|em|do|da)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+(?:de|da|do)\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)?)/);
    const entityMatch = clean.match(/(?:reputação\s+(?:da|do|de)\s+)([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s/]+?)(?:\s+(?:em|no|na|para|,)|$)/i);
    return {
      entity: entityMatch ? entityMatch[1].trim() : clean.slice(0, 40),
      loc: locMatch ? locMatch[1] : 'Brasil',
      region: clean.includes('MG') || clean.includes('Belo Horizonte') ? 'MG' : 'BR',
    };
  }
}
