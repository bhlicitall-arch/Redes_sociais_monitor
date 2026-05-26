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

    // Se tiver Consumer Key + Secret, gera Bearer Token automaticamente
    if (credentials?.consumerKey && credentials?.consumerSecret) {
      try {
        const token = await this.generateBearerToken(credentials.consumerKey, credentials.consumerSecret);
        if (token) {
          this.bearerToken = token;
          this.connected = true;
          logger.info('Twitter Connector: Bearer Token gerado a partir de Consumer Key + Secret');
          return true;
        }
      } catch (err) {
        logger.error({ err }, 'Twitter Connector: falha ao gerar Bearer Token');
      }
    }

    logger.warn('Twitter Connector: sem credenciais');
    this.connected = false;
    return false;
  }

  /**
   * Gera um Bearer Token a partir de Consumer Key + Secret (OAuth 2.0)
   * POST /oauth2/token
   */
  private async generateBearerToken(consumerKey: string, consumerSecret: string): Promise<string | null> {
    try {
      const encoded = Buffer.from(consumerKey + ':' + consumerSecret).toString('base64');
      const res = await fetch('https://api.twitter.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + encoded,
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: 'grant_type=client_credentials',
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        logger.error({ status: res.status, body: text.slice(0, 200) }, 'Twitter: falha ao gerar Bearer Token');
        return null;
      }

      const data = await res.json() as any;
      if (data.token_type === 'bearer' && data.access_token) {
        return data.access_token;
      }

      logger.error({ response: data }, 'Twitter: resposta inesperada ao gerar Bearer Token');
      return null;
    } catch (error) {
      logger.error({ error }, 'Twitter: erro ao gerar Bearer Token');
      return null;
    }
  }

  async fetch(query: string, options?: FetchOptions): Promise<Mention[]> {
    if (this.bearerToken) {
      return this.fetchReal(query, options);
    }
    logger.warn('Twitter: sem token, pulando');
    return [];
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
