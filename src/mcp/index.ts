/**
 * Camada de Integração MCP (Model Context Protocol)
 *
 * Implementa o protocolo padronizado para conectar agentes a:
 * 1. Mídias Sociais: Meta (Instagram/Facebook), X (Twitter), TikTok, LinkedIn
 * 2. Mídia Tradicional: Portais de notícias, jornais, RSS, transcrição de rádio/TV
 * 3. Ferramentas Externas: Slack, WhatsApp, JIRA, APIs governamentais
 *
 * O MCP Bridge gerencia conexões, autenticação, rate limiting
 * e transformação de dados entre formatos internos e externos.
 */

import {
  MCPMessage,
  AgentType,
  MediaPlatform,
  EntityId,
} from '../types';
import { generateId, now, logger } from '../utils';

// ============================================================
// Tipos MCP
// ============================================================

export type MCPConnectionStatus = 'connected' | 'disconnected' | 'error' | 'rate_limited';

export interface MCPEndpoint {
  id: EntityId;
  name: string;
  platform: MediaPlatform | 'slack' | 'whatsapp' | 'jira' | 'gov_api';
  protocol: 'rest' | 'graphql' | 'websocket' | 'webhook' | 'rss';
  baseUrl: string;
  authType: 'bearer_token' | 'oauth2' | 'api_key' | 'none';
  status: MCPConnectionStatus;
  rateLimit: {
    maxRequestsPerMinute: number;
    currentUsage: number;
    resetAt: Date;
  };
  lastHeartbeat: Date;
}

export interface MCPResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
  latencyMs: number;
}

// ============================================================
// Gerenciador de Conexões MCP
// ============================================================

class MCPConnectionManager {
  private endpoints: Map<EntityId, MCPEndpoint> = new Map();

  constructor() {
    this.registerDefaultEndpoints();
    logger.info('MCP Connection Manager initialized');
  }

  /**
   * Registra endpoints padrão para mídias sociais e ferramentas.
   */
  private registerDefaultEndpoints(): void {
    const endpoints: MCPEndpoint[] = [
      {
        id: generateId(),
        name: 'Twitter/X API v2',
        platform: 'twitter',
        protocol: 'rest',
        baseUrl: 'https://api.twitter.com/2',
        authType: 'bearer_token',
        status: 'disconnected',
        rateLimit: { maxRequestsPerMinute: 450, currentUsage: 0, resetAt: new Date() },
        lastHeartbeat: new Date(0),
      },
      {
        id: generateId(),
        name: 'Instagram Graph API',
        platform: 'instagram',
        protocol: 'rest',
        baseUrl: 'https://graph.facebook.com/v18.0',
        authType: 'oauth2',
        status: 'disconnected',
        rateLimit: { maxRequestsPerMinute: 200, currentUsage: 0, resetAt: new Date() },
        lastHeartbeat: new Date(0),
      },
      {
        id: generateId(),
        name: 'Facebook Graph API',
        platform: 'facebook',
        protocol: 'rest',
        baseUrl: 'https://graph.facebook.com/v18.0',
        authType: 'oauth2',
        status: 'disconnected',
        rateLimit: { maxRequestsPerMinute: 200, currentUsage: 0, resetAt: new Date() },
        lastHeartbeat: new Date(0),
      },
      {
        id: generateId(),
        name: 'LinkedIn API',
        platform: 'linkedin',
        protocol: 'rest',
        baseUrl: 'https://api.linkedin.com/v2',
        authType: 'oauth2',
        status: 'disconnected',
        rateLimit: { maxRequestsPerMinute: 100, currentUsage: 0, resetAt: new Date() },
        lastHeartbeat: new Date(0),
      },
      {
        id: generateId(),
        name: 'TikTok API',
        platform: 'tiktok',
        protocol: 'rest',
        baseUrl: 'https://open-api.tiktok.com',
        authType: 'oauth2',
        status: 'disconnected',
        rateLimit: { maxRequestsPerMinute: 100, currentUsage: 0, resetAt: new Date() },
        lastHeartbeat: new Date(0),
      },
      {
        id: generateId(),
        name: 'RSS Feed Aggregator',
        platform: 'news_portal',
        protocol: 'rss',
        baseUrl: '',
        authType: 'none',
        status: 'connected',
        rateLimit: { maxRequestsPerMinute: 60, currentUsage: 0, resetAt: new Date() },
        lastHeartbeat: now(),
      },
      {
        id: generateId(),
        name: 'Slack Webhook',
        platform: 'slack',
        protocol: 'webhook',
        baseUrl: 'https://hooks.slack.com/services',
        authType: 'api_key',
        status: 'disconnected',
        rateLimit: { maxRequestsPerMinute: 60, currentUsage: 0, resetAt: new Date() },
        lastHeartbeat: new Date(0),
      },
      {
        id: generateId(),
        name: 'WhatsApp Business API',
        platform: 'whatsapp',
        protocol: 'rest',
        baseUrl: 'https://graph.facebook.com/v18.0',
        authType: 'oauth2',
        status: 'disconnected',
        rateLimit: { maxRequestsPerMinute: 250, currentUsage: 0, resetAt: new Date() },
        lastHeartbeat: new Date(0),
      },
    ];

    for (const ep of endpoints) {
      this.endpoints.set(ep.id, ep);
    }
  }

  /**
   * Conecta a um endpoint (autentica e estabelece sessão).
   */
  async connect(endpointId: EntityId, credentials?: Record<string, string>): Promise<boolean> {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      logger.error({ endpointId }, 'MCP: endpoint not found');
      return false;
    }

    try {
      // Simula handshake/autenticação
      logger.info({ endpointName: endpoint.name }, 'MCP: connecting...');
      await new Promise((resolve) => setTimeout(resolve, 100));

      endpoint.status = 'connected';
      endpoint.lastHeartbeat = now();
      endpoint.rateLimit.currentUsage = 0;

      if (credentials) {
        logger.info({ endpointName: endpoint.name }, 'MCP: authenticated with credentials');
      }

      logger.info({ endpointName: endpoint.name }, 'MCP: connected successfully');
      return true;
    } catch (error) {
      endpoint.status = 'error';
      logger.error({ endpointName: endpoint.name, error }, 'MCP: connection failed');
      return false;
    }
  }

  /**
   * Desconecta de um endpoint.
   */
  disconnect(endpointId: EntityId): boolean {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) return false;

    endpoint.status = 'disconnected';
    logger.info({ endpointName: endpoint.name }, 'MCP: disconnected');
    return true;
  }

  /**
   * Envia uma requisição através de um endpoint MCP.
   * Gerencia rate limiting e retries automáticos.
   */
  async request<T>(
    endpointId: EntityId,
    action: string,
    payload: unknown,
    maxRetries: number = 3
  ): Promise<MCPResponse<T>> {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      return { success: false, error: 'Endpoint not found', statusCode: 404, latencyMs: 0 };
    }

    if (endpoint.status !== 'connected') {
      return { success: false, error: 'Endpoint not connected', statusCode: 503, latencyMs: 0 };
    }

    // Rate limiting check
    if (endpoint.rateLimit.currentUsage >= endpoint.rateLimit.maxRequestsPerMinute) {
      const waitMs = endpoint.rateLimit.resetAt.getTime() - Date.now();
      if (waitMs > 0) {
        logger.warn({ endpointName: endpoint.name, waitMs }, 'MCP: rate limited');
        return {
          success: false,
          error: `Rate limited. Reset in ${Math.ceil(waitMs / 1000)}s`,
          statusCode: 429,
          latencyMs: 0,
        };
      }
    }

    const startTime = Date.now();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Incrementa contagem de rate limit
        endpoint.rateLimit.currentUsage++;

        // Simula chamada de API
        await new Promise((resolve) =>
          setTimeout(resolve, 50 + Math.random() * 150)
        );

        const latencyMs = Date.now() - startTime;
        endpoint.lastHeartbeat = now();

        logger.debug({
          endpointName: endpoint.name,
          action,
          latencyMs,
          attempt: attempt + 1,
        }, 'MCP: request completed');

        return {
          success: true,
          data: { action, payload, simulated: true } as unknown as T,
          statusCode: 200,
          latencyMs,
        };
      } catch (error) {
        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 100;
          logger.warn({
            endpointName: endpoint.name,
            attempt: attempt + 1,
            backoffMs,
            error,
          }, 'MCP: retrying request');
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        } else {
          const latencyMs = Date.now() - startTime;
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            statusCode: 500,
            latencyMs,
          };
        }
      }
    }

    return {
      success: false,
      error: 'Max retries exceeded',
      statusCode: 500,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Verifica o heartbeat de todos os endpoints conectados.
   */
  async healthCheck(): Promise<Record<string, MCPConnectionStatus>> {
    const status: Record<string, MCPConnectionStatus> = {};
    for (const [id, endpoint] of this.endpoints) {
      if (endpoint.status === 'connected') {
        // Simula ping
        const age = Date.now() - endpoint.lastHeartbeat.getTime();
        status[endpoint.name] = age < 60000 ? 'connected' : 'disconnected';
      } else {
        status[endpoint.name] = endpoint.status;
      }
    }
    return status;
  }

  /**
   * Lista todos os endpoints registrados.
   */
  listEndpoints(): MCPEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  /**
   * Obtém um endpoint específico.
   */
  getEndpoint(endpointId: EntityId): MCPEndpoint | undefined {
    return this.endpoints.get(endpointId);
  }
}

// ============================================================
// MCP Bridge — Barramento de Mensagens
// ============================================================

export class MCPBridge {
  private connectionManager: MCPConnectionManager;
  private messageQueue: MCPMessage[] = [];

  constructor() {
    this.connectionManager = new MCPConnectionManager();
    logger.info('MCP Bridge initialized');
  }

  /**
   * Obtém o gerenciador de conexões.
   */
  get connections(): MCPConnectionManager {
    return this.connectionManager;
  }

  /**
   * Envia uma mensagem entre agentes ou para um endpoint externo.
   */
  async sendMessage(message: Omit<MCPMessage, 'id' | 'timestamp'>): Promise<MCPMessage> {
    const fullMessage: MCPMessage = {
      ...message,
      id: generateId(),
      timestamp: now(),
    };

    this.messageQueue.push(fullMessage);

    logger.debug({
      source: fullMessage.source,
      target: fullMessage.target,
      action: fullMessage.action,
    }, 'MCP: message sent');

    return fullMessage;
  }

  /**
   * Escuta mensagens de um agente específico.
   */
  getMessagesForAgent(agentType: AgentType): MCPMessage[] {
    return this.messageQueue.filter(
      (m) => m.target === agentType || m.target === 'mcp_bridge'
    );
  }

  /**
   * Conecta a uma plataforma de mídia social via MCP.
   * Se a plataforma for 'slack' ou 'whatsapp', conecta como ferramenta externa.
   */
  async connectPlatform(
    platform: MediaPlatform | 'slack' | 'whatsapp' | 'jira' | 'gov_api',
    credentials?: Record<string, string>
  ): Promise<boolean> {
    const endpoints = this.connectionManager.listEndpoints();
    const targetEndpoint = endpoints.find((e) => e.platform === platform);

    if (!targetEndpoint) {
      logger.error({ platform }, 'MCP: no endpoint configured for platform');
      return false;
    }

    return this.connectionManager.connect(targetEndpoint.id, credentials);
  }

  /**
   * Desconecta de uma plataforma.
   */
  disconnectPlatform(platform: MediaPlatform | 'slack' | 'whatsapp'): boolean {
    const endpoints = this.connectionManager.listEndpoints();
    const targetEndpoint = endpoints.find((e) => e.platform === platform);
    if (!targetEndpoint) return false;

    return this.connectionManager.disconnect(targetEndpoint.id);
  }

  /**
   * Envia um alerta para um canal externo (Slack, WhatsApp, Email).
   */
  async sendAlert(
    channel: 'slack' | 'whatsapp' | 'email',
    message: string,
    severity: string
  ): Promise<MCPResponse> {
    const platform = channel === 'email' ? 'gov_api' : channel;
    const endpoints = this.connectionManager.listEndpoints();
    const endpoint = endpoints.find((e) => e.platform === platform);

    if (!endpoint) {
      return { success: false, error: `No endpoint for channel ${channel}`, statusCode: 404, latencyMs: 0 };
    }

    if (endpoint.status !== 'connected') {
      // Tenta conectar automaticamente
      await this.connectionManager.connect(endpoint.id);
    }

    return this.connectionManager.request(endpoint.id, `send_${channel}_alert`, {
      message,
      severity,
      timestamp: now().toISOString(),
    });
  }

  /**
   * Faz uma busca em uma plataforma de mídia social.
   */
  async searchSocialMedia(
    platform: MediaPlatform,
    query: string,
    options?: { limit?: number; language?: string; region?: string }
  ): Promise<MCPResponse> {
    const endpoints = this.connectionManager.listEndpoints();
    const endpoint = endpoints.find((e) => e.platform === platform);

    if (!endpoint) {
      return { success: false, error: `No endpoint for platform ${platform}`, statusCode: 404, latencyMs: 0 };
    }

    if (endpoint.status !== 'connected') {
      return { success: false, error: `Platform ${platform} not connected`, statusCode: 503, latencyMs: 0 };
    }

    return this.connectionManager.request(endpoint.id, 'search', {
      query,
      ...options,
    });
  }

  /**
   * Verifica a saúde de todas as conexões MCP.
   */
  async healthCheck(): Promise<Record<string, MCPConnectionStatus>> {
    return this.connectionManager.healthCheck();
  }
}

// Singleton
export const mcpBridge = new MCPBridge();
