/**
 * Facebook Connector — Graph API (paginas publicas)
 *
 * Docs: https://developers.facebook.com/docs/graph-api
 * Precisa: Facebook App + Page Access Token
 *
 * Modo simulado quando sem credenciais.
 */

import { BaseConnector, FetchOptions } from './base-connector';
import { Mention, MediaPlatform } from '../types';
import { generateId, now, logger } from '../utils';

export class FacebookConnector extends BaseConnector {
  readonly platform: MediaPlatform = 'facebook';
  readonly name = 'Facebook Graph API';
  readonly hasApi = true;
  readonly requiresAuth = true;

  private accessToken = '';

  async connect(credentials?: Record<string, string>): Promise<boolean> {
    if (credentials?.accessToken) {
      this.accessToken = credentials.accessToken;
      this.connected = true;
      logger.info('Facebook Connector: autenticado');
      return true;
    }
    logger.warn('Facebook Connector: sem credenciais, modo simulacao');
    this.connected = true;
    return true;
  }

  async fetch(query: string, options?: FetchOptions): Promise<Mention[]> {
    if (this.accessToken) return this.fetchReal(query, options);
    return this.fetchSimulated(query, options);
  }

  private async fetchReal(query: string, options?: FetchOptions): Promise<Mention[]> {
    try {
      const url = `https://graph.facebook.com/v18.0/search?q=${encodeURIComponent(query)}&type=post&fields=message,permalink_url,created_time,from&access_token=${this.accessToken}&limit=${options?.limit || 10}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json() as any;
      return (data.data || []).map((post: any) => ({
        id: post.id,
        source: this.buildSourceMetadata('facebook', post.from?.name || 'Usuario', post.permalink_url || ''),
        rawContent: post.message || '',
        collectedAt: now(),
      }));
    } catch (error) {
      logger.error({ error }, 'Facebook API: falha');
      return [];
    }
  }

  private async fetchSimulated(query: string, options?: FetchOptions): Promise<Mention[]> {
    return []; // BLOQUEADO pelo barramento de validacao
  }
}
