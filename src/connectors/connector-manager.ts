/**
 * Connector Manager — Gerenciamento de conectores reais
 *
 * Credenciais sao persistidas no SQLite e carregadas automaticamente
 * ao iniciar o servidor.
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

  /**
   * Carrega credenciais de variaveis de ambiente primeiro (persistem no Render),
   * depois tenta do banco SQLite como fallback.
   */
  loadFromEnvironment(): void {
    const envMap: Array<{ platform: MediaPlatform; envVar: string; field: string }> = [
      { platform: 'twitter', envVar: 'TWITTER_BEARER_TOKEN', field: 'bearerToken' },
      { platform: 'instagram', envVar: 'INSTAGRAM_ACCESS_TOKEN', field: 'accessToken' },
      { platform: 'facebook', envVar: 'FACEBOOK_ACCESS_TOKEN', field: 'accessToken' },
      { platform: 'youtube', envVar: 'YOUTUBE_API_KEY', field: 'apiKey' },
    ];

    for (const entry of envMap) {
      const value = process.env[entry.envVar];
      if (value && value.length > 10) {
        this.config[entry.platform] = { [entry.field]: value };
        logger.info({ platform: entry.platform }, 'ConnectorManager: credencial carregada de env var');
      }
    }
  }

  /**
   * Carrega credenciais do banco de dados (fallback)
   */
  loadFromDatabase(): void {
    try {
      const { getDb } = require('../db');
      const db = getDb();
      const rows = db.prepare('SELECT platform, credentials FROM connector_credentials').all() as any[];
      for (const row of rows) {
        try {
          this.config[row.platform as MediaPlatform] = JSON.parse(row.credentials);
          logger.info({ platform: row.platform }, 'ConnectorManager: credenciais carregadas do banco');
        } catch { /* ignore parse errors */ }
      }
    } catch (e) {
      logger.warn({ error: String(e) }, 'ConnectorManager: nao foi possivel carregar credenciais');
    }
  }

  /**
   * Salva/atualiza credenciais no banco de dados e na memoria
   */
  configure(platform: MediaPlatform, credentials: Record<string, string>): void {
    this.config[platform] = credentials;

    // Persiste no banco
    try {
      const { getDb } = require('../db');
      const db = getDb();
      db.prepare(`
        INSERT INTO connector_credentials (id, platform, credentials, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(platform) DO UPDATE SET credentials = ?, updated_at = datetime('now')
      `).run(
        platform + '_creds', platform, JSON.stringify(credentials), JSON.stringify(credentials)
      );
      logger.info({ platform }, 'ConnectorManager: credenciais persistidas no banco');
    } catch (e) {
      logger.warn({ platform, error: String(e) }, 'ConnectorManager: falha ao persistir');
    }
  }

  async connect(platform: MediaPlatform): Promise<boolean> {
    const connector = this.connectors.get(platform);
    if (!connector) { logger.warn({ platform }, 'ConnectorManager: nao encontrado'); return false; }
    return connector.connect(this.config[platform]);
  }

  /**
   * Conecta todas as plataformas.
   * Plataformas sem autenticacao conectam automaticamente.
   * Plataformas com auth conectam se houver credenciais salvas.
   */
  async connectAll(): Promise<void> {
    // Carrega credenciais: env vars > banco > nenhuma
    this.loadFromEnvironment();
    this.loadFromDatabase();

    for (const [platform, connector] of this.connectors) {
      if (!connector.requiresAuth) {
        await connector.connect();
        logger.info({ platform }, 'ConnectorManager: conexao automatica');
      } else {
        const creds = this.config[platform];
        if (creds && Object.keys(creds).length > 0) {
          await connector.connect(creds);
          logger.info({ platform }, 'ConnectorManager: reconectado com credenciais salvas');
        }
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
