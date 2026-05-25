/**
 * Connector Manager — Gerenciamento de conectores reais
 */

import { Mention, MediaPlatform } from '../types';
import { IConnector } from './base-connector';
import { TwitterConnector } from './twitter-connector';
import { NewsRSSConnector } from './news-rss-connector';
import { InstagramConnector } from './instagram-connector';
import { FacebookConnector } from './facebook-connector';
import { YouTubeConnector } from './youtube-connector';
import { logger } from '../utils';

type ConnectorConfig = {
  [K in MediaPlatform]?: Record<string, string>;
};

export class ConnectorManager {
  private connectors: Map<MediaPlatform, IConnector> = new Map();
  private config: ConnectorConfig = {};

  constructor() { this.registerDefaults(); }

  private registerDefaults(): void {
    this.connectors.set('twitter', new TwitterConnector());
    this.connectors.set('instagram', new InstagramConnector());
    this.connectors.set('facebook', new FacebookConnector());
    this.connectors.set('youtube', new YouTubeConnector());
    this.connectors.set('news_portal', new NewsRSSConnector());
    logger.info('ConnectorManager: 5 conectores registrados');
  }

  configure(platform: MediaPlatform, credentials: Record<string, string>): void {
    this.config[platform] = credentials;
    logger.info({ platform }, 'ConnectorManager: credenciais configuradas');
  }

  async connect(platform: MediaPlatform): Promise<boolean> {
    const connector = this.connectors.get(platform);
    if (!connector) { logger.warn({ platform }, 'ConnectorManager: nao encontrado'); return false; }
    return connector.connect(this.config[platform]);
  }

  async connectAll(): Promise<void> {
    for (const [platform, connector] of this.connectors) {
      if (!connector.requiresAuth) {
        await connector.connect();
        logger.info({ platform }, 'ConnectorManager: conexao automatica');
      } else {
        const creds = this.config[platform];
        if (creds) await connector.connect(creds);
      }
    }
  }

  async fetch(platform: MediaPlatform, query: string, options?: { limit?: number }): Promise<Mention[]> {
    const connector = this.connectors.get(platform);
    if (!connector) return [];
    return connector.fetch(query, { limit: options?.limit });
  }

  async fetchAll(query: string, options?: { limit?: number }): Promise<Mention[]> {
    const all: Mention[] = [];
    const results = await Promise.allSettled(
      Array.from(this.connectors.keys()).map(p => this.fetch(p, query, options))
    );
    for (const r of results) {
      if (r.status === 'fulfilled') all.push(...r.value);
    }
    return all;
  }

  getStatus(): Array<{ platform: MediaPlatform; name: string; connected: boolean; hasApi: boolean }> {
    return Array.from(this.connectors.values()).map(c => ({
      platform: c.platform, name: c.name, connected: c.isConnected(), hasApi: c.hasApi,
    }));
  }

  getConnector(platform: MediaPlatform): IConnector | undefined {
    return this.connectors.get(platform);
  }
}

export const connectorManager = new ConnectorManager();
