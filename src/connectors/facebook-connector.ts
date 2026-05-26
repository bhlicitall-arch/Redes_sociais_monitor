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
    logger.warn('Facebook Connector: sem accessToken');
    this.connected = false;
    return false;
  }

  async fetch(query: string, options?: FetchOptions): Promise<Mention[]> {
    if (!this.accessToken) return [];
    return this.fetchReal(query, options);
  }

  private async fetchReal(query: string, options?: FetchOptions): Promise<Mention[]> {
    try {
      // Extrai termos-chave para multiplas tentativas
      const termos = query.replace(/^(monitorar|reputação\s+(da|do|de)\s+|relatorio\s+)/i, '')
        .split(/\s+/).filter(w => w.length > 3).slice(0, 3);
      const mentions: Mention[] = [];

      for (const termo of termos) {
        try {
          const url = `https://graph.facebook.com/v18.0/search?q=${encodeURIComponent(termo)}&type=post&fields=message,permalink_url,created_time,from&access_token=${this.accessToken}&limit=5`;
          const res = await fetch(url);
          if (!res.ok) continue;
          const data = await res.json() as any;
          if (data.data) {
            for (const post of data.data) {
              mentions.push({
                id: post.id,
                source: this.buildSourceMetadata('facebook', post.from?.name || 'Usuario', post.permalink_url || ''),
                rawContent: post.message || '',
                collectedAt: now(),
              });
            }
          }
        } catch { continue; }
      }

      logger.info({ termos, count: mentions.length }, 'Facebook API: resultados');
      return mentions;
    } catch (error) {
      logger.error({ error }, 'Facebook API: falha');
      return [];
    }
  }
}
