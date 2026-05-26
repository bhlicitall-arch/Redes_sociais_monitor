/**
 * Instagram Connector — Graph API (Instagram Business/Creator)
 *
 * Docs: https://developers.facebook.com/docs/instagram-api
 * Precisa: Instagram Business Account + Facebook App + Access Token
 *
 * Modo simulado quando sem credenciais.
 */

import { BaseConnector, FetchOptions } from './base-connector';
import { Mention, MediaPlatform } from '../types';
import { generateId, now, logger } from '../utils';

export class InstagramConnector extends BaseConnector {
  readonly platform: MediaPlatform = 'instagram';
  readonly name = 'Instagram Graph API';
  readonly hasApi = true;
  readonly requiresAuth = true;

  private accessToken = '';
  private businessId = '';

  async connect(credentials?: Record<string, string>): Promise<boolean> {
    if (credentials?.accessToken) {
      this.accessToken = credentials.accessToken;
      this.businessId = credentials.businessId || '';
      this.connected = true;
      logger.info('Instagram Connector: autenticado');
      return true;
    }
    logger.warn('Instagram Connector: sem credenciais, modo simulacao');
    this.connected = true;
    return true;
  }

  async fetch(query: string, options?: FetchOptions): Promise<Mention[]> {
    if (this.accessToken && this.businessId) {
      return this.fetchReal(query, options);
    }
    return this.fetchSimulated(query, options);
  }

  private async fetchReal(query: string, options?: FetchOptions): Promise<Mention[]> {
    try {
      // Busca mencoes do Instagram via Graph API (hashtag search)
      const tag = query.replace(/\s/g, '').toLowerCase();
      const url = `https://graph.facebook.com/v18.0/ig_hashtag_search?user_id=${this.businessId}&q=${tag}&access_token=${this.accessToken}`;
      const res = await fetch(url);
      if (!res.ok) return [];

      const data = await res.json() as any;
      if (!data.data) return [];

      // Para cada hashtag, busca midias recentes
      const mentions: Mention[] = [];
      for (const tag of data.data.slice(0, 3)) {
        const mediaUrl = `https://graph.facebook.com/v18.0/${tag.id}/recent_media?user_id=${this.businessId}&fields=caption,permalink,like_count,comments_count,timestamp&access_token=${this.accessToken}`;
        const mediaRes = await fetch(mediaUrl);
        const mediaData = await mediaRes.json() as any;
        if (mediaData.data) {
          for (const post of mediaData.data) {
            mentions.push({
              id: post.id,
              source: this.buildSourceMetadata('instagram', '@user_instagram', post.permalink || 'https://instagram.com/p/' + post.id),
              rawContent: post.caption || '',
              collectedAt: now(),
            });
          }
        }
      }
      return mentions;
    } catch (error) {
      logger.error({ error }, 'Instagram API: falha');
      return [];
    }
  }

  /**
   * Retorna array vazio — Instagram nao tem dados simulados.
   * So retorna dados se a API real responder com resultados.
   */
  private async fetchSimulated(query: string, options?: FetchOptions): Promise<Mention[]> {
    return []; // BLOQUEADO pelo barramento de validacao
  }
}
