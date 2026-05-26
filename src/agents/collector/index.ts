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
import { filterBatchWithAI } from '../../ai/analyzer';

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

      // === FILTRO INTELIGENTE POR IA (MULTI-PROVEDOR) ===
      let mencoesViaIA = todasMencoes;
      let iaRejeitadas = 0;
      const temIA = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);

      if (todasMencoes.length > 0 && temIA) {
        logger.info({
          total: todasMencoes.length,
          query,
          temIA: true,
        }, 'Collector: aplicando filtro multi-provedor IA');

        const iaResults = await filterBatchWithAI(
          todasMencoes.map(m => ({
            id: m.id,
            conteudo: m.rawContent,
            plataforma: m.source.platform,
          })),
          query,
        );

        if (iaResults.length > 0) {
          const idsRelevantes = new Set(iaResults.map(r => r.id));
          mencoesViaIA = todasMencoes.filter(m => idsRelevantes.has(m.id));
          iaRejeitadas = todasMencoes.length - mencoesViaIA.length;

          logger.info({
            antes: todasMencoes.length,
            depois: mencoesViaIA.length,
            rejeitadas: iaRejeitadas,
          }, 'Collector: filtro IA aplicado');
        }
      } else if (todasMencoes.length > 0 && !temIA) {
        logger.warn('Collector: nenhuma IA configurada — dados sem filtro. Configure GEMINI_API_KEY ou GROQ_API_KEY');
      }

      logger.info({
        totalMencoes: mencoesViaIA.length,
        plataformasAtivas: resultados.filter(r => r.includes('validas')).length,
        filtroIA: temIA ? 'ativo' : 'ausente',
      }, 'Collector: coleta validada concluida');

      return this.success(
        { mentions: mencoesViaIA },
        mencoesViaIA.length > 0
          ? `Coleta validada: ${mencoesViaIA.length} mencoes reais de ${resultados.filter(r => r.includes('validas')).length} plataformas${iaRejeitadas > 0 ? ` (${iaRejeitadas} rejeitadas pela IA)` : ''}`
          : 'Nenhuma mencao relevante encontrada.',
        {
          totalMencoes: mencoesViaIA.length,
          plataformasComDados: resultados.filter(r => r.includes('validas')).length,
          plataformasBloqueadas: resultados.filter(r => r.includes('BLOQUEADO')).length,
          mencoesRejeitadas: rejectionReport.totalRejeitadas,
          mencoesFiltradasIA: iaRejeitadas,
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
