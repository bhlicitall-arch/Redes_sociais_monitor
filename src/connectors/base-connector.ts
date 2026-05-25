/**
 * Base Connector — Interface padrao para todos os conectores
 *
 * Cada conector implementa fetch() que retorna mencoes reais
 * da respectiva plataforma via API oficial ou scraping.
 */

import { Mention, MediaPlatform } from '../types';

export interface IConnector {
  readonly platform: MediaPlatform;
  readonly name: string;
  readonly hasApi: boolean;
  readonly requiresAuth: boolean;
  isConnected(): boolean;
  connect(credentials?: Record<string, string>): Promise<boolean>;
  fetch(query: string, options?: FetchOptions): Promise<Mention[]>;
}

export interface FetchOptions {
  limit?: number;
  language?: string;
  region?: string;
  since?: Date;
  until?: Date;
}

export abstract class BaseConnector implements IConnector {
  abstract readonly platform: MediaPlatform;
  abstract readonly name: string;
  abstract readonly hasApi: boolean;
  abstract readonly requiresAuth: boolean;

  protected connected = false;
  protected credentials: Record<string, string> = {};

  isConnected(): boolean { return this.connected; }

  async connect(credentials?: Record<string, string>): Promise<boolean> {
    if (credentials) this.credentials = credentials;
    this.connected = true;
    return true;
  }

  abstract fetch(query: string, options?: FetchOptions): Promise<Mention[]>;

  protected buildSourceMetadata(platform: MediaPlatform, author: string, url: string, region?: string): Mention['source'] {
    return {
      platform,
      timestamp: new Date(),
      language: 'pt-BR',
      region: region || 'BR',
      url,
      author,
      engagement: { likes: 0, shares: 0, comments: 0 },
    };
  }
}
