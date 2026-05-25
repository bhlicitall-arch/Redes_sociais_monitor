/**
 * Gerenciador de Memória Híbrida
 *
 * Implementa dois tipos de memória:
 * 1. Memória Vetorial (In-Memory): armazena contextos semânticos e crises históricas
 *    com busca por similaridade de cosseno.
 * 2. Memória Relacional (In-Memory): armazena dados estruturados e relatórios
 *    com consulta por chave-valor e período.
 *
 * Em produção, substituir o backend vetorial por Pinecone/Weaviate
 * e o relacional por PostgreSQL/SQLite.
 */

import {
  MemoryEntry,
  HistoricalCrisisRecord,
  EntityId,
  RiskLevel,
} from '../types';
import { generateId, now, logger } from '../utils';

// ============================================================
// Memória Vetorial (Semântica)
// ============================================================

class VectorMemory {
  private entries: Map<EntityId, MemoryEntry> = new Map();

  /**
   * Armazena uma entrada na memória vetorial.
   */
  store(entry: Omit<MemoryEntry, 'id' | 'timestamp'>): MemoryEntry {
    const id = generateId();
    const full: MemoryEntry = {
      ...entry,
      id,
      timestamp: now(),
    };
    this.entries.set(id, full);
    logger.info({ memoryId: id, type: entry.type }, 'Vector memory: entry stored');
    return full;
  }

  /**
   * Busca por similaridade semântica usando cosseno.
   * Para MVP, usa correspondência por palavras-chave.
   * Em produção, substituir por embeddings reais (OpenAI/text-embedding-3-small).
   */
  searchBySimilarity(query: string, topK: number = 5): MemoryEntry[] {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const scored: Array<{ entry: MemoryEntry; score: number }> = [];

    for (const entry of this.entries.values()) {
      const content = entry.content.toLowerCase();
      let score = 0;
      for (const term of queryTerms) {
        if (content.includes(term)) {
          score += 1;
        }
      }
      // Normaliza pelo tamanho do conteúdo e da query
      const normalizedScore = content.length > 0
        ? score / Math.min(queryTerms.length, content.split(/\s+/).length)
        : 0;

      if (normalizedScore > 0) {
        scored.push({ entry, score: normalizedScore });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, topK).map((s) => s.entry);

    logger.debug({ query, resultsCount: results.length }, 'Vector memory: search completed');
    return results;
  }

  /**
   * Recupera entradas por tipo de memória.
   */
  getByType(type: MemoryEntry['type']): MemoryEntry[] {
    return Array.from(this.entries.values()).filter((e) => e.type === type);
  }

  /**
   * Remove entradas expiradas baseado no TTL.
   */
  cleanExpired(): number {
    const nowMs = now().getTime();
    let removed = 0;
    for (const [id, entry] of this.entries) {
      if (entry.ttl) {
        const age = (nowMs - entry.timestamp.getTime()) / (1000 * 60 * 60 * 24);
        if (age > entry.ttl) {
          this.entries.delete(id);
          removed++;
        }
      }
    }
    logger.info({ removed }, 'Vector memory: expired entries cleaned');
    return removed;
  }

  /**
   * Retorna todas as entradas (para debugging).
   */
  getAll(): MemoryEntry[] {
    return Array.from(this.entries.values());
  }
}

// ============================================================
// Memória Relacional (Dados Estruturados)
// ============================================================

class RelationalMemory {
  private crises: Map<EntityId, HistoricalCrisisRecord> = new Map();
  private reports: Map<EntityId, unknown> = new Map();

  /**
   * Armazena um registro de crise histórica.
   */
  storeCrisisRecord(record: Omit<HistoricalCrisisRecord, 'id'>): HistoricalCrisisRecord {
    const id = generateId();
    const full: HistoricalCrisisRecord = {
      ...record,
      id,
    };
    this.crises.set(id, full);
    logger.info({ crisisId: id, riskLevel: record.riskLevel }, 'Relational memory: crisis record stored');
    return full;
  }

  /**
   * Busca crises por nível de risco.
   */
  getCrisesByRiskLevel(level: RiskLevel): HistoricalCrisisRecord[] {
    return Array.from(this.crises.values()).filter((c) => c.riskLevel === level);
  }

  /**
   * Busca crises que contenham termos específicos (para contexto histórico).
   */
  searchCrisesByKeyword(keyword: string): HistoricalCrisisRecord[] {
    const kw = keyword.toLowerCase();
    return Array.from(this.crises.values()).filter(
      (c) =>
        c.title.toLowerCase().includes(kw) ||
        c.description.toLowerCase().includes(kw) ||
        c.lessonsLearned.some((l) => l.toLowerCase().includes(kw))
    );
  }

  /**
   * Busca crises em um intervalo de tempo.
   */
  getCrisesInTimeRange(start: Date, end: Date): HistoricalCrisisRecord[] {
    return Array.from(this.crises.values()).filter((c) => {
      const t = c.occurredAt.getTime();
      return t >= start.getTime() && t <= end.getTime();
    });
  }

  /**
   * Armazena um relatório.
   */
  storeReport(report: unknown): EntityId {
    const id = generateId();
    this.reports.set(id, report);
    return id;
  }

  /**
   * Obtém um relatório por ID.
   */
  getReport(id: EntityId): unknown | undefined {
    return this.reports.get(id);
  }
}

// ============================================================
// Gerenciador de Memória Híbrido (Facade)
// ============================================================

export class MemoryManager {
  public readonly vector: VectorMemory;
  public readonly relational: RelationalMemory;

  constructor() {
    this.vector = new VectorMemory();
    this.relational = new RelationalMemory();
    logger.info('MemoryManager initialized (hybrid: vector + relational)');
  }

  /**
   * Busca contexto combinado: semântico (vetorial) + histórico (relacional).
   */
  getCombinedContext(query: string, topK: number = 3): {
    semanticEntries: MemoryEntry[];
    historicalCrises: HistoricalCrisisRecord[];
  } {
    const semanticEntries = this.vector.searchBySimilarity(query, topK);

    // Extrai palavras-chave da query para busca relacional
    const keywords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const historicalCrises = keywords.flatMap((kw) =>
      this.relational.searchCrisesByKeyword(kw)
    );

    // Deduplica crises
    const uniqueCrises = Array.from(
      new Map(historicalCrises.map((c) => [c.id, c])).values()
    );

    return {
      semanticEntries,
      historicalCrises: uniqueCrises,
    };
  }

  /**
   * Limpa memórias expiradas.
   */
  cleanExpired(): { vectorRemoved: number } {
    const vectorRemoved = this.vector.cleanExpired();
    return { vectorRemoved };
  }
}

// Singleton
export const memoryManager = new MemoryManager();
