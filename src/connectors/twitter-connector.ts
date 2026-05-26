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
  /**
   * Retorna array vazio — Twitter nao gera dados simulados.
   * So retorna dados da API real.
   */
  private async fetchSimulated(query: string, options?: FetchOptions): Promise<Mention[]> {
    return []; // BLOQUEADO pelo barramento de validacao
  }
}
