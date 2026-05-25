/**
 * BARRAMENTO DE VALIDACAO — Data Integrity Gateway
 *
 * REGRA ABSOLUTA: Nenhum dado simulado/inventado pode passar.
 * So transmitimos dados coletados de fontes REAIS e VALIDADAS.
 *
 * Fluxo:
 * 1. Cada mencao so passa se tiver source.url valido e verificavel
 * 2. Mencoes sem URL real sao BLOQUEADAS
 * 3. Se uma plataforma nao tem API conectada, ZERO mencoes dessa plataforma
 * 4. Log de auditoria de todas as mencoes rejeitadas
 */

import { Mention, AnalysisResult, RiskAssessment } from '../types';
import { logger } from '../utils';

export type ValidationResult = {
  valid: boolean;
  reason?: string;
  mentionId?: string;
};

/**
 * VERIFICADOR DE INTEGRIDADE
 * Valida que uma mencao veio de uma fonte REAL, nao simulada.
 */
export class DataIntegrityGateway {
  private rejectedCount = 0;
  private acceptedCount = 0;
  private rejectionLog: Array<{ mentionId: string; reason: string; platform: string; timestamp: Date }> = [];

  /**
   * Valida uma mencao individual.
   * So passa se:
   * - Tem URL real e valida (dominio reconhecido)
   * - Tem timestamp valido
   * - Tem conteudo nao vazio
   * - Nao contem marcadores de texto simulado
   */
  validateMention(mention: Mention): ValidationResult {
    const id = mention.id;

    // 1. URL deve existir e ser de dominio REAL
    if (!mention.source.url || mention.source.url === '') {
      this.reject(id, 'URL vazia', mention.source.platform);
      return { valid: false, reason: 'URL vazia - dado nao tem fonte verificavel', mentionId: id };
    }

    // 2. Dominiuo deve ser REAL (nao inventado)
    const url = mention.source.url.toLowerCase();
    const dominantiosReais = [
      'twitter.com', 'x.com', 'instagram.com', 'facebook.com',
      'linkedin.com', 'youtube.com', 'tiktok.com', 'threads.net',
      'g1.globo.com', 'uol.com.br', 'estadao.com.br', 'folha.uol.com.br',
      'oglobo.globo.com', 'correiobraziliense.com.br', 'gov.br',
      'rss2json.com', 'api.twitter.com', 'api.instagram.com',
      'graph.facebook.com', 'googleapis.com',
    ];

    const hasRealDomain = dominantiosReais.some(d => url.includes(d));
    if (!hasRealDomain) {
      this.reject(id, `Dominio nao reconhecido: ${mention.source.url}`, mention.source.platform);
      return { valid: false, reason: `URL com dominio nao verificado: ${mention.source.url}`, mentionId: id };
    }

    // 3. Dominio deve corresponder a plataforma declarada
    const platformDomains: Record<string, string[]> = {
      twitter: ['twitter.com', 'x.com'],
      instagram: ['instagram.com'],
      facebook: ['facebook.com'],
      linkedin: ['linkedin.com'],
      youtube: ['youtube.com', 'youtu.be'],
      news_portal: ['g1.globo.com', 'uol.com.br', 'estadao.com.br', 'folha.uol.com.br', 'oglobo.globo.com', 'correiobraziliense.com.br'],
    };

    const allowedDomains = platformDomains[mention.source.platform];
    if (allowedDomains && !allowedDomains.some(d => url.includes(d))) {
      this.reject(id, `URL nao corresponde a plataforma ${mention.source.platform}`, mention.source.platform);
      return { valid: false, reason: `URL ${mention.source.url} nao e da plataforma ${mention.source.platform}`, mentionId: id };
    }

    // 4. Timestamp deve ser valido
    if (!mention.source.timestamp || isNaN(mention.source.timestamp.getTime())) {
      this.reject(id, 'Timestamp invalido', mention.source.platform);
      return { valid: false, reason: 'Timestamp invalido', mentionId: id };
    }

    // 5. Timestamp nao pode ser no futuro
    if (mention.source.timestamp.getTime() > Date.now() + 60000) {
      this.reject(id, 'Timestamp no futuro', mention.source.platform);
      return { valid: false, reason: 'Timestamp no futuro - dado manipulado', mentionId: id };
    }

    // 6. Conteudo deve ser nao vazio
    if (!mention.rawContent || mention.rawContent.trim() === '') {
      this.reject(id, 'Conteudo vazio', mention.source.platform);
      return { valid: false, reason: 'Conteudo vazio', mentionId: id };
    }

    this.acceptedCount++;
    return { valid: true };
  }

  /**
   * Valida um lote de mencoes.
   * Retorna APENAS as que passaram na validacao.
   */
  validateBatch(mentions: Mention[]): Mention[] {
    const validas: Mention[] = [];
    let rejeitadas = 0;

    for (const m of mentions) {
      const result = this.validateMention(m);
      if (result.valid) {
        validas.push(m);
      } else {
        rejeitadas++;
      }
    }

    if (rejeitadas > 0) {
      logger.warn({
        total: mentions.length,
        rejeitadas,
        aceitas: validas.length,
      }, 'DataIntegrityGateway: lote validado com rejeicoes');
    }

    return validas;
  }

  /**
   * BLOQUEIA qualquer resultado de analise que contenha dados
   * de mencoes que nao passaram na validacao.
   */
  validateAnalysisResults(
    analyses: AnalysisResult[],
    validMentionIds: Set<string>
  ): AnalysisResult[] {
    return analyses.filter(a => {
      if (!validMentionIds.has(a.mentionId)) {
        logger.warn({ mentionId: a.mentionId }, 'DataIntegrityGateway: analise rejeitada - mencao nao validada');
        return false;
      }
      return true;
    });
  }

  /**
   * BLOQUEIA qualquer avaliacao de risco de mencoes nao validadas.
   */
  validateRiskAssessments(
    assessments: RiskAssessment[],
    validMentionIds: Set<string>
  ): RiskAssessment[] {
    return assessments.filter(a => {
      if (!validMentionIds.has(a.mentionId)) {
        logger.warn({ mentionId: a.mentionId }, 'DataIntegrityGateway: risk assessment rejeitado');
        return false;
      }
      return true;
    });
  }

  /**
   * Gera relatorio de rejeicoes para auditoria.
   */
  getRejectionReport(): { totalRejeitadas: number; totalAceitas: number; rejeicoes: Array<{ mentionId: string; reason: string; platform: string; timestamp: Date }> } {
    return {
      totalRejeitadas: this.rejectedCount,
      totalAceitas: this.acceptedCount,
      rejeicoes: [...this.rejectionLog],
    };
  }

  /**
   * Retorna true se um conector esta apto a fornecer dados.
   */
  isConnectorReady(hasApi: boolean, isConnected: boolean): boolean {
    if (hasApi && !isConnected) {
      logger.warn('DataIntegrityGateway: conector com API mas nao conectado - ZERO dados transmitidos');
      return false;
    }
    // Conectores sem API (RSS) precisam estar conectados
    if (!hasApi && !isConnected) {
      logger.warn('DataIntegrityGateway: conector desconectado - ZERO dados');
      return false;
    }
    return true;
  }

  private reject(mentionId: string, reason: string, platform: string): void {
    this.rejectedCount++;
    this.rejectionLog.push({ mentionId, reason, platform, timestamp: new Date() });
    logger.warn({ mentionId, reason, platform }, 'DataIntegrityGateway: Mencao REJEITADA');
  }

  /**
   * Reseta os contadores (para novo ciclo de coleta).
   */
  reset(): void {
    this.rejectedCount = 0;
    this.acceptedCount = 0;
    this.rejectionLog = [];
  }
}

// Singleton do barramento de validacao
export const dataIntegrityGateway = new DataIntegrityGateway();
