/**
 * RSS News Connector — Portais de noticia via RSS
 *
 * Conecta-se a feeds RSS de portais brasileiros:
 * - G1: https://g1.globo.com/rss/g1/
 * - UOL: https://rss.uol.com.br/
 * - Estadão: https://www.estadao.com.br/rss/
 *
 * Modo simulado quando sem rede.
 */

import { BaseConnector, FetchOptions } from './base-connector';
import { Mention, MediaPlatform } from '../types';
import { generateId, now, logger } from '../utils';

const RSS_FEEDS = [
  { name: 'G1 MG', url: 'https://g1.globo.com/rss/g1/mg/' },
  { name: 'G1 Brasil', url: 'https://g1.globo.com/rss/g1/' },
  { name: 'UOL Noticias', url: 'https://rss.uol.com.br/feed/noticias.xml' },
];

export class NewsRSSConnector extends BaseConnector {
  readonly platform: MediaPlatform = 'news_portal';
  readonly name = 'RSS News Aggregator';
  readonly hasApi = false;
  readonly requiresAuth = false;

  async fetch(query: string, options?: FetchOptions): Promise<Mention[]> {
    try {
      const mentions: Mention[] = [];
      for (const feed of RSS_FEEDS) {
        try {
          const items = await this.fetchFeed(feed.url, query, options?.limit || 5);
          mentions.push(...items);
        } catch {
          logger.warn({ feed: feed.name }, 'RSS: feed indisponivel');
        }
      }
      if (mentions.length > 0) return mentions;
    } catch { /* fallback para simulado */ }

    return this.fetchSimulated(query, options);
  }

  private async fetchFeed(feedUrl: string, query: string, limit: number): Promise<Mention[]> {
    // Usa RSS-to-JSON service (gratuito: rss2json.com)
    const apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(feedUrl);
    const res = await fetch(apiUrl);
    if (!res.ok) return [];

    const data = await res.json() as any;
    if (data.status !== 'ok') return [];

    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(w => w.length > 3);

    return (data.items || [])
      .filter((item: any) => {
        const text = (item.title + ' ' + (item.description || '')).toLowerCase();
        return queryTerms.some(term => text.includes(term));
      })
      .slice(0, limit)
      .map((item: any) => ({
        id: generateId(),
        source: this.buildSourceMetadata('news_portal', item.author || 'Redacao', item.link),
        rawContent: item.title + '. ' + (item.description || '').replace(/<[^>]*>/g, '').slice(0, 200),
        collectedAt: now(),
      }));
  }

  private async fetchSimulated(query: string, options?: FetchOptions): Promise<Mention[]> {
    return []; // BLOQUEADO pelo barramento de validacao
  }
}
