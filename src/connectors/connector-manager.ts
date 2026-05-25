/**
 * Connector Manager — Gerenciamento de conectores reais
 *
 * Centraliza todos os conectores e expoe um metodo unificado fetch().
 * Cliente configura as credenciais via dashboard ou variaveis de ambiente.
 */

import { Mention, MediaPlatform } from '../types';
import { IConnector } from './base-connector';
import { TwitterConnector } from './twitter-connector';
import { NewsRSSConnector } from './news-rss-connector';
import { logger } from '../utils';

type ConnectorConfig = {
  [K in MediaPlatform]?: Record<string, string>;
};

export class ConnectorManager {
  private connectors: Map<MediaPlatform, IConnector> = new Map();
  private config: ConnectorConfig = {};

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.connectors.set('twitter', new TwitterConnector());
    this.connectors.set('news_portal', new NewsRSSConnector());
    // TODO: InstagramConnector, FacebookConnector, LinkedInConnector, YouTubeConnector
    logger.info('ConnectorManager: conectores padrao registrados');
  }

  /**
   * Configura credenciais para uma plataforma
   */
  configure(platform: MediaPlatform, credentials: Record<string, string>): void {
    this.config[platform] = credentials;
    logger.info({ platform }, 'ConnectorManager: credenciais configuradas');
  }

  /**
   * Conecta a uma plataforma (com ou sem credenciais)
   */
  async connect(platform: MediaPlatform): Promise<boolean> {
    const connector = this.connectors.get(platform);
    if (!connector) {
      logger.warn({ platform }, 'ConnectorManager: conector nao encontrado');
      return false;
    }
    const creds = this.config[platform];
    return connector.connect(creds);
  }

  /**
   * Conecta a todas as plataformas configuradas
   */
  async connectAll(): Promise<void> {
    for (const [platform, connector] of this.connectors) {
      const creds = this.config[platform];
      await connector.connect(creds);
    }
  }

  /**
   * Busca mencoes em uma plataforma especifica
   */
  async fetch(platform: MediaPlatform, query: string, options?: { limit?: number }): Promise<Mention[]> {
    const connector = this.connectors.get(platform);
    if (!connector) return [];
    return connector.fetch(query, { limit: options?.limit });
  }

  /**
   * Busca mencoes em todas as plataformas disponiveis
   */
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

  /**
   * Verifica status de todas as conexoes
   */
  getStatus(): Array<{ platform: MediaPlatform; name: string; connected: boolean; hasApi: boolean }> {
    return Array.from(this.connectors.values()).map(c => ({
      platform: c.platform,
      name: c.name,
      connected: c.isConnected(),
      hasApi: c.hasApi,
    }));
  }

  /**
   * Obtem um conector especifico
   */
  getConnector(platform: MediaPlatform): IConnector | undefined {
    return this.connectors.get(platform);
  }
}

export const connectorManager = new ConnectorManager();
