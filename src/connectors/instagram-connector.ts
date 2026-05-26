/**
 * Instagram Connector — Graph API
 *
 * Precisa: Instagram Business Account + Facebook App + Access Token + Business ID
 *
 * NOTA: Instagram Graph API exige businessId (ID da conta business do Instagram).
 * Sem businessId, o conector retorna vazio.
 * O token do Access Token pode ser obtido no Facebook Developers.
 */

import { BaseConnector, FetchOptions } from './base-connector';
import { Mention, MediaPlatform } from '../types';
import { now, logger } from '../utils';

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
      this.connected = !!credentials.businessId;
      logger.info({
        hasToken: !!this.accessToken,
        hasBusinessId: !!this.businessId,
      }, 'Instagram Connector: autenticado');
      return this.connected;
    }
    logger.warn('Instagram Connector: sem accessToken');
    this.connected = false;
    return false;
  }

  async fetch(query: string, options?: FetchOptions): Promise<Mention[]> {
    if (!this.accessToken) return [];
    if (!this.businessId) {
      logger.warn('Instagram: businessId nao configurado. Adicione INSTAGRAM_BUSINESS_ID nas Env Vars');
      return [];
    }
    return this.fetchReal(query, options);
  }

  private async fetchReal(query: string, options?: FetchOptions): Promise<Mention[]> {
    try {
      const termos = query
        .replace(/^(monitorar|reputação\s+(da|do|de)\s+|relatorio\s+)/i, '')
        .split(/\s+/).filter(w => w.length > 3).slice(0, 3);

      const mentions: Mention[] = [];

      for (const termo of termos) {
        try {
          const tag = termo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
          const url = `https://graph.facebook.com/v18.0/ig_hashtag_search?user_id=${this.businessId}&q=${tag}&access_token=${this.accessToken}`;
          const res = await fetch(url);
          if (!res.ok) {
            logger.warn({ termo, status: res.status }, 'Instagram: erro hashtag');
            continue;
          }
          const data = await res.json() as any;
          if (!data.data) continue;

          for (const hashtag of data.data.slice(0, 2)) {
            try {
              const mediaUrl = `https://graph.facebook.com/v18.0/${hashtag.id}/recent_media?user_id=${this.businessId}&fields=caption,permalink,like_count,comments_count,timestamp&access_token=${this.accessToken}`;
              const mediaRes = await fetch(mediaUrl);
              if (!mediaRes.ok) continue;
              const mediaData = await mediaRes.json() as any;
              if (mediaData.data) {
                for (const post of mediaData.data) {
                  mentions.push({
                    id: post.id,
                    source: this.buildSourceMetadata('instagram', '@user', post.permalink || ''),
                    rawContent: post.caption || '',
                    collectedAt: now(),
                  });
                }
              }
            } catch { continue; }
          }
        } catch { continue; }
      }

      logger.info({ termos, count: mentions.length }, 'Instagram API: resultados');
      return mentions;
    } catch (error) {
      logger.error({ error }, 'Instagram API: falha');
      return [];
    }
  }
}
