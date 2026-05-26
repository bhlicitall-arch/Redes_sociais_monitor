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
      // Extrai termos-chave da query (remove palavras genericas)
      const termos = query
        .replace(/^(monitorar|reputação\s+(da|do|de)\s+|relatorio\s+)/i, '')
        .replace(/[´`¨^~,;.!?]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3 && !['para','com','sua','seus','pelo','pela','sobre','entre','depois','antes','como','mais','muito','quando','onde','porque','tambem','ainda','durante','atraves','contra','dentro','fora','nessa','neste','nesta','pelos','pelas'].includes(w.toLowerCase()))
        .slice(0, 4);

      // Tenta variacoes da query para maximizar resultados
      const queries = [
        termos.join(' ') + ' lang:pt',
        query.replace(/^(monitorar|reputação\s+(da|do|de)\s+|relatorio\s+)/i, '').trim().slice(0, 50) + ' lang:pt -is:retweet',
        termos.slice(0, 2).join(' ') + ' lang:pt',
      ];

      let allTweets: any[] = [];
      for (const q of queries) {
        const url = new URL('https://api.twitter.com/2/tweets/search/recent');
        url.searchParams.set('query', q);
        url.searchParams.set('max_results', '10');
        url.searchParams.set('tweet.fields', 'public_metrics,author_id,created_at,lang');

        const res = await fetch(url.toString(), {
          headers: { Authorization: 'Bearer ' + this.bearerToken },
        });

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          logger.warn({ status: res.status, query: q, body: body.slice(0, 100) }, 'Twitter API: erro');
          continue;
        }

        const data = await res.json() as any;
        if (data.data) allTweets.push(...data.data);
      }

      // Deduplica por ID
      const seen = new Set();
      const tweets = allTweets.filter((t: any) => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });

      logger.info({ query, queriesTentadas: queries.length, count: tweets.length }, 'Twitter API: resultados');

      return tweets.map((tweet: any) => ({
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
  /**
   * Retorna array vazio — Twitter nao gera dados simulados.
   * So retorna dados da API real.
   */
  private async fetchSimulated(query: string, options?: FetchOptions): Promise<Mention[]> {
    return []; // BLOQUEADO pelo barramento de validacao
  }
}
