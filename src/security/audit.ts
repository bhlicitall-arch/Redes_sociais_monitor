/**
 * Logs de Auditoria Imutáveis — Rastreabilidade Completa
 *
 * Responsabilidades:
 * - Registrar cada ação de agente em log seguro e imutável
 * - Encadear logs via hash (blockchain-like) para garantir integridade
 * - Suporte a consulta de auditoria por agente, ação ou período
 * - Exportação de trilha de auditoria para conformidade LGPD
 *
 * Estrutura: cada entrada contém o hash da entrada anterior,
 * formando uma corrente que torna a adulteração detectável.
 */

import { AuditLogEntry, AgentType } from '../types';
import { generateId, now, sha256, logger } from '../utils';
import * as fs from 'fs';
import * as path from 'path';

export class AuditLogger {
  private chain: AuditLogEntry[] = [];
  private previousHash: string = '0'; // Genesis hash
  private logPath: string;

  constructor(logPath?: string) {
    this.logPath = logPath || process.env.AUDIT_LOG_PATH || './logs/audit';
    this.ensureLogDirectory();
    logger.info('AuditLogger initialized (immutable chain)');
  }

  /**
   * Garante que o diretório de logs existe.
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logPath)) {
      fs.mkdirSync(this.logPath, { recursive: true });
    }
  }

  /**
   * Registra uma entrada no log de auditoria.
   * A entrada é automaticamente encadeada com hash do registro anterior.
   */
  async log(params: {
    agentType: AgentType;
    action: string;
    resourceType: string;
    resourceId: string;
    details: string;
    severity: AuditLogEntry['severity'];
  }): Promise<AuditLogEntry> {
    const entryData = {
      timestamp: now(),
      agentType: params.agentType,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      details: params.details,
      severity: params.severity,
      immutable: true as const,
      previousHash: this.previousHash,
    };

    // Serializa e calcula hash (inclui previousHash para encadeamento)
    const serialized = JSON.stringify(entryData);
    const hash = sha256(serialized);

    const entry: AuditLogEntry = {
      id: generateId(),
      ...entryData,
      hash,
    };

    // Armazena na chain em memória
    this.chain.push(entry);

    // Atualiza previousHash para a próxima entrada
    this.previousHash = hash;

    // Persiste em disco (log rotacionado por data)
    await this.persist(entry);

    logger.debug({
      auditId: entry.id,
      agent: entry.agentType,
      action: entry.action,
      hash: entry.hash.slice(0, 12),
    }, 'Audit log entry recorded');

    return entry;
  }

  /**
   * Persiste a entrada de auditoria em disco.
   * Usa arquivos diários para facilitar rotação.
   */
  private async persist(entry: AuditLogEntry): Promise<void> {
    const dateStr = entry.timestamp.toISOString().split('T')[0];
    const filePath = path.join(this.logPath, `audit-${dateStr}.jsonl`);

    try {
      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(filePath, line, 'utf-8');
    } catch (error) {
      logger.error({ error, filePath }, 'AuditLogger: failed to persist entry');
    }
  }

  /**
   * Verifica a integridade da chain de auditoria.
   * Recalcula hashes e compara com os armazenados.
   */
  verifyChainIntegrity(): { valid: boolean; brokenEntries: number } {
    let previousHash = '0';
    let brokenEntries = 0;

    for (const entry of this.chain) {
      const { hash, ...rest } = entry;
      const { id, ...dataWithoutId } = rest;

      // Recalcula hash excluindo id e hash
      const serialized = JSON.stringify(dataWithoutId);
      const computedHash = sha256(serialized);

      if (computedHash !== hash) {
        brokenEntries++;
        logger.error({ auditId: entry.id }, 'AuditLogger: chain integrity BREACHED!');
      }

      if (dataWithoutId.previousHash !== previousHash) {
        brokenEntries++;
        logger.error({ auditId: entry.id }, 'AuditLogger: chain link BROKEN!');
      }

      previousHash = hash;
    }

    const valid = brokenEntries === 0;
    logger.info({ valid, brokenEntries, totalEntries: this.chain.length },
      valid ? 'Audit chain integrity verified' : 'Audit chain integrity COMPROMISED');

    return { valid, brokenEntries };
  }

  /**
   * Busca entradas de auditoria por critérios.
   */
  query(params: {
    agentType?: AgentType;
    action?: string;
    resourceType?: string;
    severity?: AuditLogEntry['severity'];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): AuditLogEntry[] {
    let results = [...this.chain];

    if (params.agentType) {
      results = results.filter((e) => e.agentType === params.agentType);
    }
    if (params.action) {
      results = results.filter((e) => e.action === params.action);
    }
    if (params.resourceType) {
      results = results.filter((e) => e.resourceType === params.resourceType);
    }
    if (params.severity) {
      results = results.filter((e) => e.severity === params.severity);
    }
    if (params.startDate) {
      results = results.filter((e) => e.timestamp >= params.startDate!);
    }
    if (params.endDate) {
      results = results.filter((e) => e.timestamp <= params.endDate!);
    }

    // Ordena por timestamp decrescente (mais recente primeiro)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (params.limit && params.limit > 0) {
      results = results.slice(0, params.limit);
    }

    return results;
  }

  /**
   * Exporta trilha de auditoria para relatório de conformidade.
   */
  exportComplianceReport(startDate: Date, endDate: Date): string {
    const entries = this.query({ startDate, endDate });
    const verified = this.verifyChainIntegrity();

    const lines: string[] = [
      '# Relatório de Conformidade — Logs de Auditoria',
      '',
      `Período: ${startDate.toISOString()} a ${endDate.toISOString()}`,
      `Total de Entradas: ${entries.length}`,
      `Integridade da Cadeia: ${verified.valid ? 'VÁLIDA' : 'COMPROMETIDA'}`,
      `Entradas com Problemas: ${verified.brokenEntries}`,
      '',
      '## Entradas de Auditoria',
      '',
      '| ID | Timestamp | Agente | Ação | Recurso | Severidade | Hash |',
      '|----|-----------|--------|------|---------|------------|------|',
    ];

    for (const entry of entries) {
      lines.push(
        `| ${entry.id.slice(0, 8)} | ${entry.timestamp.toISOString()} | ${entry.agentType} | ${entry.action} | ${entry.resourceType}:${entry.resourceId.slice(0, 8)} | ${entry.severity} | ${entry.hash.slice(0, 12)} |`
      );
    }

    lines.push('', '---', '*Relatório gerado automaticamente — Plataforma Agentic de Monitoramento Superior*');

    return lines.join('\n');
  }
}
