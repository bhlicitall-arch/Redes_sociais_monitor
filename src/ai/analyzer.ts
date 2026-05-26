/**
 * AI Analyzer — Filtro Inteligente de Conteudo
 *
 * Usa API da Anthropic (Claude) para:
 * 1. Verificar se uma mencao e realmente relevante ao objetivo
 * 2. Classificar sentimento com precisao
 * 3. Extrair entidades nomeadas
 * 4. Rejeitar conteudo fora de contexto
 *
 * Se a API nao estiver configurada, retorna dados sem filtro IA.
 * (mas ainda passando pelo barramento de validacao de integridade)
 */

import { logger } from '../utils';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export type AIAnalysisResult = {
  relevante: boolean;
  confianca: number;
  sentimento: 'positivo' | 'neutro' | 'negativo';
  sentimentoScore: number;
  topicos: string[];
  entidades: Array<{ nome: string; tipo: string }>;
  resumo: string;
  motivoRejeicao?: string;
};

/**
 * Analisa uma mencao com IA para verificar relevancia ao contexto.
 */
export async function analyzeWithAI(
  conteudo: string,
  objetivo: string
): Promise<AIAnalysisResult | null> {
  if (!ANTHROPIC_API_KEY) {
    return null; // IA nao configurada — passa sem filtro
  }

  try {
    const prompt = `Voce e um analista de midia especializado em monitoramento reputacional.

TAREFA: Analise a mencao abaixo e determine se ela e RELEVANTE para o objetivo de monitoramento.

OBJETIVO: "${objetivo}"

MENCAO: "${conteudo}"

Responda APENAS com um JSON valido, sem marcadores, sem texto extra:
{
  "relevante": true/false,
  "confianca": 0.0 a 1.0,
  "sentimento": "positivo" | "neutro" | "negativo",
  "sentimentoScore": -1.0 a 1.0,
  "topicos": ["topico1", "topico2"],
  "entidades": [{"nome": "entidade", "tipo": "pessoa|organizacao|local|evento|outro"}],
  "resumo": "resumo de uma frase",
  "motivoRejeicao": "se relevante=false, explicar o motivo"
}`;

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      logger.error({ status: response.status }, 'AI Analyzer: falha na API');
      return null;
    }

    const data = await response.json() as any;
    const text = data.content?.[0]?.text || '';

    // Extrai JSON da resposta
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('AI Analyzer: resposta sem JSON valido');
      return null;
    }

    const result = JSON.parse(jsonMatch[0]) as AIAnalysisResult;
    logger.info({
      relevante: result.relevante,
      confianca: result.confianca,
      sentimento: result.sentimento,
      topicos: result.topicos?.length,
    }, 'AI Analyzer: analise concluida');

    return result;
  } catch (error) {
    logger.error({ error }, 'AI Analyzer: erro na analise');
    return null;
  }
}

/**
 * Filtra um lote de mencoes usando IA.
 * Retorna apenas as consideradas relevantes.
 */
export async function filterBatchWithAI(
  mencoes: Array<{ id: string; conteudo: string; plataforma: string }>,
  objetivo: string
): Promise<Array<{ id: string; analise: AIAnalysisResult }>> {
  if (!ANTHROPIC_API_KEY) {
    logger.info('AI Analyzer: nao configurado (ANTHROPIC_API_KEY ausente)');
    return [];
  }

  const resultados: Array<{ id: string; analise: AIAnalysisResult }> = [];
  const batchSize = 5; // Processa em lotes para nao estourar rate limit

  for (let i = 0; i < mencoes.length; i += batchSize) {
    const batch = mencoes.slice(i, i + batchSize);
    const promises = batch.map(m =>
      analyzeWithAI(m.conteudo, objetivo)
        .then(analise => ({ id: m.id, analise, plataforma: m.plataforma }))
    );

    const results = await Promise.allSettled(promises);
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.analise) {
        resultados.push({ id: r.value.id, analise: r.value.analise });
      }
    }

    // Delay entre lotes para rate limiting
    if (i + batchSize < mencoes.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  const relevantes = resultados.filter(r => r.analise.relevante);
  const rejeitados = resultados.filter(r => !r.analise.relevante);

  logger.info({
    total: resultados.length,
    relevantes: relevantes.length,
    rejeitados: rejeitados.length,
  }, 'AI Analyzer: filtragem concluida');

  return relevantes;
}
