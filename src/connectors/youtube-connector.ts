/**
 * YouTube Connector — Data API v3
 *
 * Docs: https://developers.google.com/youtube/v3
 * Precisa: API Key (gratuita, 10.000 requests/dia)
 *
 * Modo simulado quando sem chave.
 */

import { BaseConnector, FetchOptions } from './base-connector';
import { Mention, MediaPlatform } from '../types';
import { generateId, now, logger } from '../utils';

export class YouTubeConnector extends BaseConnector {
  readonly platform: MediaPlatform = 'youtube';
  readonly name = 'YouTube Data API';
  readonly hasApi = true;
  readonly requiresAuth = true;

  private apiKey = '';

  async connect(credentials?: Record<string, string>): Promise<boolean> {
    if (credentials?.apiKey) {
      this.apiKey = credentials.apiKey;
      this.connected = true;
      logger.info('YouTube Connector: autenticado');
      return true;
    }
    logger.warn('YouTube Connector: sem chave, modo simulacao');
    this.connected = true;
    return true;
  }

  async fetch(query: string, options?: FetchOptions): Promise<Mention[]> {
    if (this.apiKey) return this.fetchReal(query, options);
    return this.fetchSimulated(query, options);
  }

  private async fetchReal(query: string, options?: FetchOptions): Promise<Mention[]> {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${options?.limit || 10}&key=${this.apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json() as any;
      return (data.items || []).map((item: any) => ({
        id: item.id?.videoId || generateId(),
        source: {
          platform: 'youtube', timestamp: new Date(item.snippet.publishedAt),
          language: 'pt-BR', region: 'BR',
          url: 'https://youtube.com/watch?v=' + item.id?.videoId,
          author: item.snippet.channelTitle,
          engagement: { likes: 0, shares: 0, comments: 0, views: 0 },
        },
        rawContent: item.snippet.title + ' — ' + (item.snippet.description || '').slice(0, 200),
        collectedAt: now(),
      }));
    } catch (error) {
      logger.error({ error }, 'YouTube API: falha');
      return [];
    }
  }

  private async fetchSimulated(query: string, options?: FetchOptions): Promise<Mention[]> {
    return []; // BLOQUEADO pelo barramento de validacao
  }
}
