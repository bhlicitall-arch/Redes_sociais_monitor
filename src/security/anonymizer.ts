/**
 * Anonimizador Dinâmico — Conformidade com LGPD
 *
 * Responsabilidades:
 * - Identificar e anonimizar dados pessoais antes do processamento por LLMs
 * - Oferecer múltiplos níveis de anonimização (leve, moderado, completo)
 * - Suporte a padrões brasileiros: CPF, RG, CNPJ, telefone, CEP, email
 * - Log de anonimização para auditoria de conformidade
 */

import { logger } from '../utils';

// ============================================================
// Padrões de Dados Pessoais (LGPD — Lei Geral de Proteção de Dados)
// ============================================================

const PII_PATTERNS: Array<{ name: string; regex: RegExp; replacement: string }> = [
  // CPF: 000.000.000-00 ou 00000000000
  { name: 'CPF', regex: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, replacement: 'XXX.XXX.XXX-XX' },
  // CNPJ: 00.000.000/0000-00
  { name: 'CNPJ', regex: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, replacement: 'XX.XXX.XXX/XXXX-XX' },
  // RG: 00.000.000-X
  { name: 'RG', regex: /\b\d{2}\.?\d{3}\.?\d{3}-?[0-9Xx]\b/g, replacement: 'XX.XXX.XXX-X' },
  // Telefone: (00) 00000-0000 ou 0000-0000
  { name: 'PHONE', regex: /\(?\d{2}\)?\s?\d{4,5}-?\d{4}\b/g, replacement: '(XX) XXXXX-XXXX' },
  // CEP: 00000-000
  { name: 'CEP', regex: /\b\d{5}-?\d{3}\b/g, replacement: 'XXXXX-XXX' },
  // Email
  { name: 'EMAIL', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: 'email@anonimizado.com' },
  // Endereço IP
  { name: 'IP', regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: 'XXX.XXX.XXX.XXX' },
  // Nomes completos (heurística: duas ou mais palavras com inicial maiúscula seguidas)
  // CUIDADO: pode gerar falsos positivos com nomes de entidades
  { name: 'FULL_NAME', regex: /\b[A-Z][a-záéíóúâêôãõçàèìòùäëïöüñ]{2,}\s[A-Z][a-záéíóúâêôãõçàèìòùäëïöüñ]{2,}\b/g, replacement: '[NOME ANONIMIZADO]' },
];

export type AnonymizationLevel = 'light' | 'moderate' | 'full';

// ============================================================
// Anonimizador
// ============================================================

export class Anonymizer {
  private anonymizationLog: Array<{
    timestamp: Date;
    patternName: string;
    occurrences: number;
    level: AnonymizationLevel;
  }> = [];

  /**
   * Anonimiza um texto baseado no nível especificado.
   *
   * @param text - Texto original contendo possíveis dados pessoais
   * @param level - Nível de anonimização:
   *   - 'light': apenas CPF, email, telefone
   *   - 'moderate': light + RG, CNPJ, CEP
   *   - 'full': moderate + nomes próprios, IPs
   * @returns Texto anonimizado
   */
  anonymize(text: string, level: AnonymizationLevel = 'moderate'): string {
    if (!text || text.trim().length === 0) {
      return text;
    }

    let anonymized = text;
    const patternsToApply = this.getPatternsForLevel(level);
    let totalOccurrences = 0;

    for (const pattern of patternsToApply) {
      const matches = anonymized.match(pattern.regex);
      const occurrences = matches ? matches.length : 0;

      if (occurrences > 0) {
        anonymized = anonymized.replace(pattern.regex, pattern.replacement);
        totalOccurrences += occurrences;

        this.anonymizationLog.push({
          timestamp: new Date(),
          patternName: pattern.name,
          occurrences,
          level,
        });

        logger.debug({
          pattern: pattern.name,
          occurrences,
          level,
        }, 'Anonymizer: data masked');
      }
    }

    if (totalOccurrences > 0) {
      logger.info({
        totalOccurrences,
        level,
        patternsFound: this.anonymizationLog.length,
      }, 'Anonymizer: text processed');
    }

    return anonymized;
  }

  /**
   * Anonimiza um objeto recursivamente, processando todas as strings.
   */
  anonymizeObject<T extends Record<string, unknown>>(
    obj: T,
    level: AnonymizationLevel = 'moderate'
  ): T {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.anonymize(value, level);
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.anonymizeObject(value as Record<string, unknown>, level);
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) => {
          if (typeof item === 'string') return this.anonymize(item, level);
          if (item && typeof item === 'object') return this.anonymizeObject(item, level);
          return item;
        });
      } else {
        result[key] = value;
      }
    }

    return result as T;
  }

  /**
   * Retorna os padrões aplicáveis para cada nível de anonimização.
   */
  private getPatternsForLevel(level: AnonymizationLevel): typeof PII_PATTERNS {
    const allPatterns = PII_PATTERNS;

    switch (level) {
      case 'light':
        return allPatterns.filter((p) =>
          ['CPF', 'EMAIL', 'PHONE'].includes(p.name)
        );
      case 'moderate':
        return allPatterns.filter((p) =>
          !['IP', 'FULL_NAME'].includes(p.name)
        );
      case 'full':
        return allPatterns;
      default:
        return allPatterns;
    }
  }

  /**
   * Retorna o log de anonimização para auditoria.
   */
  getAuditLog(): Array<{
    timestamp: Date;
    patternName: string;
    occurrences: number;
    level: AnonymizationLevel;
  }> {
    return [...this.anonymizationLog];
  }

  /**
   * Limpa o log de anonimização.
   */
  clearLog(): void {
    this.anonymizationLog = [];
  }
}

// Singleton
export const anonymizer = new Anonymizer();
