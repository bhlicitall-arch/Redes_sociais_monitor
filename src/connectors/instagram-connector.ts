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

  private async fetchSimulated(query: string, options?: FetchOptions): Promise<Mention[]> {
    await new Promise(r => setTimeout(r, 50 + Math.random() * 80));
    const ctx = this.extractContext(query);
    const templates = [
      `📍 ${ctx.loc} | A populacao comenta sobre ${ctx.entity}. O que voce acha? #${ctx.loc.replace(/\s/g, '')}`,
      `📸 ${ctx.entity} em ${ctx.loc} — vejam as imagens que estao circulando!`,
      `😡 Populacao de ${ctx.loc} reclama da gestao de ${ctx.entity}. #reclamacao`,
    ];
    return templates.map(t => ({
      id: generateId(),
      source: {
        platform: 'instagram', timestamp: new Date(Date.now() - Math.random() * 86400000),
        language: 'pt-BR', region: ctx.region,
        url: 'https://instagram.com/p/' + generateId().slice(0, 8),
        author: '@' + ['cidadao_mg', 'bh_agora', 'mg_noticias', 'opiniao_publica'][Math.floor(Math.random() * 4)],
        engagement: {
          likes: Math.floor(Math.random() * 2000) + 100,
          shares: Math.floor(Math.random() * 200) + 10,
          comments: Math.floor(Math.random() * 150) + 5,
          views: Math.floor(Math.random() * 30000) + 1000,
        },
      },
      rawContent: t, collectedAt: now(),
    }));
  }

  private extractContext(query: string): { entity: string; loc: string; region: string } {
    let clean = query.replace(/^(Coletar menções relacionadas a:|Monitorar:|Gerar relatorio:)\s*/i, '').trim();
    const locMatch = clean.match(/(?:de|em|do|da)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+(?:de|da|do)\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)?)/);
    const entityMatch = clean.match(/(?:reputação\s+(?:da|do|de)\s+)([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s/]+?)(?:\s+(?:em|no|na|para|,)|$)/i);
    return {
      entity: entityMatch ? entityMatch[1].trim() : clean.slice(0, 40),
      loc: locMatch ? locMatch[1] : 'Brasil',
      region: clean.includes('Belo Horizonte') || clean.includes('MG') ? 'MG' : 'BR',
    };
  }
}
