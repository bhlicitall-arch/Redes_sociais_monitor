/**
 * Collector Agent — Coleta Validada de Dados
 *
 * REGRA ABSOLUTA: Nao simula, nao inventa, nao altera.
 * So transmite dados de fontes REAIS validadas pelo Data Integrity Gateway.
 *
 * Se uma plataforma nao tem API conectada, retorna ZERO mencoes.
 */

import { BaseAgent } from '../base-agent';
import {
  Task, TaskResult, AgentType, Mention, MediaPlatform,
} from '../../types';
import { now, logger } from '../../utils';
import { connectorManager } from '../../connectors/connector-manager';
import { dataIntegrityGateway } from '../../validation/data-integrity';

export class CollectorAgent extends BaseAgent {
  readonly type: AgentType = 'collector';

  constructor() {
    super();
    logger.info('Collector Agent initialized - MODO VALIDADO (sem simulacao)');
  }

  async execute(task: Task): Promise<TaskResult> {
    this.logStart(task);
    dataIntegrityGateway.reset();

    try {
      const query = this.extractCleanQuery(task.objective);

      // Plataformas que temos conectores
      const plataformas: MediaPlatform[] = ['twitter', 'instagram', 'facebook', 'youtube', 'news_portal'];
      const todasMencoes: Mention[] = [];
      const resultados: string[] = [];

      for (const platform of plataformas) {
        const connector = connectorManager.getConnector(platform);
        if (!connector) {
          resultados.push(`${platform}: sem conector`);
          continue;
        }

        const status = connectorManager.getStatus().find(s => s.platform === platform);

        // TRAVA RIGIDA: se tem API mas nao esta conectado, ZERO dados
        if (!dataIntegrityGateway.isConnectorReady(status?.hasApi || false, connector.isConnected())) {
          logger.warn({ platform }, `Collector: BLOQUEADO - ${platform} nao conectada`);
          resultados.push(`${platform}: BLOQUEADO - API nao conectada`);
          continue;
        }

        // Se nao tem API (RSS), verifica se esta conectado
        if (!connector.hasApi && !connector.isConnected()) {
          resultados.push(`${platform}: desconectado`);
          continue;
        }

        logger.info({ platform }, `Collector: coletando dados REAIS de ${platform}`);
        try {
          const mencoes = await connector.fetch(query, { limit: 10 });

          if (mencoes.length === 0) {
            resultados.push(`${platform}: 0 mencoes encontradas`);
            continue;
          }

          // PASSA PELO BARRAMENTO DE VALIDACAO
          const mencoesValidadas = dataIntegrityGateway.validateBatch(mencoes);

          if (mencoesValidadas.length === 0) {
            logger.warn({ platform, total: mencoes.length }, `Collector: TODAS as mencoes de ${platform} foram REJEITADAS`);
            resultados.push(`${platform}: ${mencoes.length} mencoes REJEITADAS (nao passaram validacao)`);
            continue;
          }

          todasMencoes.push(...mencoesValidadas);
          resultados.push(`${platform}: ${mencoesValidadas.length} mencoes validas`);

          logger.info({
            platform,
            coletadas: mencoes.length,
            validadas: mencoesValidadas.length,
            rejeitadas: mencoes.length - mencoesValidadas.length,
          }, `Collector: ${platform} concluido`);
        } catch (err) {
          logger.error({ platform, error: String(err) }, `Collector: erro ao coletar ${platform}`);
          resultados.push(`${platform}: erro - ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Relatorio de rejeicoes para auditoria
      const rejectionReport = dataIntegrityGateway.getRejectionReport();
      if (rejectionReport.totalRejeitadas > 0) {
        logger.warn({
          totalRejeitadas: rejectionReport.totalRejeitadas,
          totalAceitas: rejectionReport.totalAceitas,
        }, 'Collector: mencoes rejeitadas pelo barramento de integridade');
      }

      logger.info({
        totalMencoes: todasMencoes.length,
        plataformasAtivas: resultados.filter(r => r.includes('validas')).length,
      }, 'Collector: coleta validada concluida');

      return this.success(
        { mentions: todasMencoes },
        todasMencoes.length > 0
          ? `Coleta validada: ${todasMencoes.length} mencoes reais de ${resultados.filter(r => r.includes('validas')).length} plataformas`
          : 'Nenhuma mencao real encontrada. Configure as APIs nas Configuracoes.',
        {
          totalMencoes: todasMencoes.length,
          plataformasComDados: resultados.filter(r => r.includes('validas')).length,
          plataformasBloqueadas: resultados.filter(r => r.includes('BLOQUEADO')).length,
          mencoesRejeitadas: rejectionReport.totalRejeitadas,
        }
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error({ error: msg }, 'Collector: task failed');
      return this.failure(`Coleta falhou: ${msg}`);
    }
  }

  /**
   * Extrai a query limpa removendo prefixos padrao
   */
  private extractCleanQuery(objective: string): string {
    return objective
      .replace(/^(Coletar menções relacionadas a:|Monitorar:|Gerar relatorio:)\s*/i, '')
      .replace(/^Monitorar:\s*/i, '')
      .trim();
  }
}
