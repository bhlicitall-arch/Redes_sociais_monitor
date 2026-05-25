/**
 * Camada de Segurança, Privacidade e Conformidade (LGPD)
 *
 * Integra todos os componentes de segurança:
 * - Anonimização Dinâmica (LGPD)
 * - Logs de Auditoria Imutáveis
 * - Criptografia (AES-256 para repouso, TLS 1.3 para trânsito)
 *
 * Fornece uma interface unificada para que os agentes
 * possam aplicar políticas de segurança sem se preocupar
 * com a implementação.
 */

import { anonymizer, Anonymizer, AnonymizationLevel } from './anonymizer';
import { AuditLogger } from './audit';
import { encrypt, decrypt, sha256 } from '../utils';
import { Mention, AgentType, AnalysisResult, TaskResult } from '../types';
import { logger } from '../utils';

export class SecurityManager {
  public readonly anonymizer: Anonymizer;
  public readonly auditLogger: AuditLogger;

  constructor() {
    this.anonymizer = anonymizer;
    this.auditLogger = new AuditLogger();
    logger.info('Security Manager initialized');
  }

  /**
   * Anonimiza uma menção completa antes do processamento.
   * Garante conformidade com LGPD no pipeline de dados.
   */
  anonymizeMention(mention: Mention, level: AnonymizationLevel = 'moderate'): Mention {
    const anonymized: Mention = {
      ...mention,
      rawContent: this.anonymizer.anonymize(mention.rawContent, level),
      source: {
        ...mention.source,
        author: mention.source.author
          ? this.anonymizer.anonymize(mention.source.author, 'full')
          : undefined,
        authorId: mention.source.authorId
          ? sha256(mention.source.authorId) // Hash do ID em vez de expor
          : undefined,
      },
    };

    // Se houver mídia, anonimiza metadados
    if (mention.mediaAttachments) {
      anonymized.mediaAttachments = mention.mediaAttachments.map((media) => ({
        ...media,
        hash: sha256(media.url), // Hash da URL em vez da URL original
      }));
    }

    return anonymized;
  }

  /**
   * Anonimiza um array de menções.
   */
  anonymizeMentions(mentions: Mention[], level: AnonymizationLevel = 'moderate'): Mention[] {
    return mentions.map((m) => this.anonymizeMention(m, level));
  }

  /**
   * Anonimiza resultados de análise que possam conter dados pessoais.
   */
  anonymizeAnalysis(analysis: AnalysisResult): AnalysisResult {
    return {
      ...analysis,
      entities: analysis.entities.map((e) => ({
        ...e,
        // Nomes de pessoas são anonimizados se confiança for baixa
        name: e.type === 'person' && e.confidence < 0.5
          ? '[ENTIDADE ANONIMIZADA]'
          : e.name,
      })),
      summary: this.anonymizer.anonymize(analysis.summary, 'light'),
    };
  }

  /**
   * Registra uma ação de auditoria de forma unificada.
   */
  async logAudit(params: {
    agentType: AgentType;
    action: string;
    resourceType: string;
    resourceId: string;
    details: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
  }): Promise<void> {
    await this.auditLogger.log(params);
  }

  /**
   * Criptografa dados sensíveis antes de armazenar.
   */
  encryptSensitiveData(data: string): string {
    return encrypt(data);
  }

  /**
   * Descriptografa dados previamente criptografados.
   */
  decryptSensitiveData(ciphertext: string): string {
    return decrypt(ciphertext);
  }

  /**
   * Verifica a integridade da chain de auditoria.
   */
  verifyAuditIntegrity(): { valid: boolean; brokenEntries: number } {
    return this.auditLogger.verifyChainIntegrity();
  }
}

// Singleton global de segurança
export const securityManager = new SecurityManager();
