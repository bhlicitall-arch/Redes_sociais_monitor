/**
 * Utilitários compartilhados para toda a plataforma.
 *
 * Fornece funções de logging, geração de IDs, validação
 * de configuração e helpers de criptografia.
 */

import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';
import { PlatformConfig } from '../types';

dotenv.config();

// ============================================================
// Logger Estruturado (Pino)
// ============================================================

import pino from 'pino';

const logLevel = process.env.LOG_LEVEL || 'info';

export const logger = pino({
  level: logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

// ============================================================
// Geração de IDs
// ============================================================

export function generateId(): string {
  return uuidv4();
}

// ============================================================
// Timestamp Helper
// ============================================================

export function now(): Date {
  return new Date();
}

export function timestampISO(): string {
  return now().toISOString();
}

// ============================================================
// Criptografia (AES-256)
// ============================================================

export function encrypt(text: string, key?: string): string {
  const secretKey = key || process.env.ENCRYPTION_KEY || 'default-dev-key-32-bytes-long!!';
  return CryptoJS.AES.encrypt(text, secretKey).toString();
}

export function decrypt(ciphertext: string, key?: string): string {
  const secretKey = key || process.env.ENCRYPTION_KEY || 'default-dev-key-32-bytes-long!!';
  const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// ============================================================
// Hash SHA-256 (para auditoria)
// ============================================================

export function sha256(data: string): string {
  return CryptoJS.SHA256(data).toString(CryptoJS.enc.Hex);
}

// ============================================================
// Configuração da Plataforma
// ============================================================

export function loadConfig(): PlatformConfig {
  const config: PlatformConfig = {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    encryptionKey: process.env.ENCRYPTION_KEY || 'default-dev-key-32-bytes-long!!',
    logLevel: process.env.LOG_LEVEL || 'info',
    auditLogPath: process.env.AUDIT_LOG_PATH || './logs/audit',
    vectorMemoryType: (process.env.VECTOR_MEMORY_TYPE as PlatformConfig['vectorMemoryType']) || 'memory',
    mcpServerPort: parseInt(process.env.MCP_SERVER_PORT || '4000', 10),
    socialMedia: {},
  };

  if (process.env.TWITTER_BEARER_TOKEN) {
    config.socialMedia.twitter = { bearerToken: process.env.TWITTER_BEARER_TOKEN };
  }

  return { ...config };
}
