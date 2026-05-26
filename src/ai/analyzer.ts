/**
 * AI Analyzer — Multi-Provedor de Analise Inteligente
 *
 * Suporta:
 * - Anthropic (Claude) — ENV: ANTHROPIC_API_KEY
 * - OpenAI (GPT)      — ENV: OPENAI_API_KEY
 * - Google Gemini     — ENV: GEMINI_API_KEY
 * - Groq (LLaMA)      — ENV: GROQ_API_KEY
 *
 * O sistema tenta cada provedor na ordem de prioridade ate encontrar
 * uma chave configurada. Se nenhuma estiver ativa, retorna sem filtro IA.
 */

import { logger } from '../utils';

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

const PROMPT_TEMPLATE = `Voce e um analista de midia especializado em monitoramento reputacional.

TAREFA: Analise a mencao abaixo e determine se ela e RELEVANTE para o objetivo de monitoramento.

OBS: Se o conteudo estiver em outro idioma (ingles, chines, etc.) ou for sobre temas completamente alheios (tecnologia, saude, entretenimento, etc.), marque como "relevante: false".

OBJETIVO: "{objetivo}"

MENCAO: "{conteudo}"

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

// ============================================================
// Provedores
// ============================================================

interface AIProvider {
  name: string;
  envKey: string;
  call(prompt: string): Promise<string | null>;
}

const providers: AIProvider[] = [
  {
    name: 'Anthropic Claude',
    envKey: 'ANTHROPIC_API_KEY',
    async call(prompt: string): Promise<string | null> {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return null;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) { logger.warn({ status: res.status }, 'Anthropic: falha'); return null; }
      const data = await res.json() as any;
      return data.content?.[0]?.text || null;
    },
  },
  {
    name: 'OpenAI GPT',
    envKey: 'OPENAI_API_KEY',
    async call(prompt: string): Promise<string | null> {
      const key = process.env.OPENAI_API_KEY;
      if (!key) return null;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) { logger.warn({ status: res.status }, 'OpenAI: falha'); return null; }
      const data = await res.json() as any;
      return data.choices?.[0]?.message?.content || null;
    },
  },
  {
    name: 'Google Gemini',
    envKey: 'GEMINI_API_KEY',
    async call(prompt: string): Promise<string | null> {
      const key = process.env.GEMINI_API_KEY;
      if (!key) return null;

      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 500 },
          }),
        },
      );
      if (!res.ok) { logger.warn({ status: res.status }, 'Gemini: falha'); return null; }
      const data = await res.json() as any;
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    },
  },
  {
    name: 'Groq (LLaMA)',
    envKey: 'GROQ_API_KEY',
    async call(prompt: string): Promise<string | null> {
      const key = process.env.GROQ_API_KEY;
      if (!key) return null;

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) { logger.warn({ status: res.status }, 'Groq: falha'); return null; }
      const data = await res.json() as any;
      return data.choices?.[0]?.message?.content || null;
    },
  },
];

// ============================================================
// Analise Individual
// ============================================================

async function tryProviders(
  conteudo: string,
  objetivo: string
): Promise<AIAnalysisResult | null> {
  const prompt = PROMPT_TEMPLATE
    .replace('{objetivo}', objetivo)
    .replace('{conteudo}', conteudo.slice(0, 500));

  for (const provider of providers) {
    if (!process.env[provider.envKey]) continue;

    logger.info({ provider: provider.name }, 'AI: tentando provedor');
    try {
      const text = await provider.call(prompt);
      if (!text) continue;

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      const result = JSON.parse(jsonMatch[0]) as AIAnalysisResult;
      logger.info({
        provider: provider.name,
        relevante: result.relevante,
        confianca: result.confianca,
      }, 'AI: analise concluida');

      return result;
    } catch (error) {
      logger.warn({ provider: provider.name, error: String(error) }, 'AI: erro no provedor');
      continue;
    }
  }

  return null;
}

// ============================================================
// API Publica
// ============================================================

/**
 * Analisa uma mencao com IA (tenta todos os provedores configurados).
 * Retorna null se nenhum provedor estiver ativo.
 */
export async function analyzeWithAI(
  conteudo: string,
  objetivo: string
): Promise<AIAnalysisResult | null> {
  const providersDisponiveis = providers.filter(p => process.env[p.envKey]);
  if (providersDisponiveis.length === 0) {
    return null; // Nenhuma IA configurada
  }

  return tryProviders(conteudo, objetivo);
}

/**
 * Filtra um lote de mencoes usando IA.
 * Retorna apenas as consideradas relevantes.
 */
export async function filterBatchWithAI(
  mencoes: Array<{ id: string; conteudo: string; plataforma: string }>,
  objetivo: string
): Promise<Array<{ id: string; analise: AIAnalysisResult }>> {
  const providersDisponiveis = providers.filter(p => process.env[p.envKey]);
  if (providersDisponiveis.length === 0) {
    logger.info('AI: nenhum provedor configurado. Configure ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY ou GROQ_API_KEY');
    return [];
  }

  logger.info({
    provedores: providersDisponiveis.map(p => p.name),
    totalMencoes: mencoes.length,
  }, 'AI: iniciando filtragem multi-provedor');

  const resultados: Array<{ id: string; analise: AIAnalysisResult }> = [];
  const batchSize = 5;

  for (let i = 0; i < mencoes.length; i += batchSize) {
    const batch = mencoes.slice(i, i + batchSize);
    const promises = batch.map(m =>
      analyzeWithAI(m.conteudo, objetivo)
        .then(analise => ({ id: m.id, analise }))
    );

    const results = await Promise.allSettled(promises);
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.analise) {
        resultados.push({ id: r.value.id, analise: r.value.analise });
      }
    }

    if (i + batchSize < mencoes.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  const relevantes = resultados.filter(r => r.analise.relevante);
  const rejeitados = resultados.filter(r => !r.analise.relevante);

  logger.info({
    totalAnalisados: resultados.length,
    relevantes: relevantes.length,
    rejeitados: rejeitados.length,
  }, 'AI: filtragem concluida');

  return relevantes;
}
