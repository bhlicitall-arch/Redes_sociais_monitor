# Histórico de Desenvolvimento — Midia Monitor

> **Plataforma:** Midia Monitor — By Techlicense
> **Repositório:** https://github.com/bhlicitall-arch/Redes_sociais_monitor
> **Produção:** https://redes-sociais-monitor.onrender.com
> **Período:** Maio/2026

---

## Sumário

1. [Fase 1 — Arquitetura Inicial](#fase-1--arquitetura-inicial)
2. [Fase 2 — Core da Plataforma](#fase-2--core-da-plataforma)
3. [Fase 3 — Frontend e Deploy](#fase-3--frontend-e-deploy)
4. [Fase 4 — Modelo Comercial SaaS](#fase-4--modelo-comercial-saas)
5. [Fase 5 — Relatório Analítico e Persistência](#fase-5--relatorio-analitico-e-persistencia)
6. [Fase 6 — Identidade Visual Midia Monitor](#fase-6--identidade-visual-midia-monitor)
7. [Fase 7 — Conectores Reais e Barramento de Validação](#fase-7--conectores-reais-e-barramento-de-validacao)
8. [Fase 8 — IA Multi-Provedor](#fase-8--ia-multi-provedor)
9. [Fase 9 — Filtro por Data](#fase-9--filtro-por-data)
10. [Lições Aprendidas](#licoes-aprendidas)
11. [Roadmap Futuro](#roadmap-futuro)

---

## Fase 1 — Arquitetura Inicial

### O que foi feito
- Criação do documento `Detalhamento da Arquitetura Técnica_ Plataforma Agentic de Monitoramento Superior.md`
- Definição da arquitetura Agentic First com:
  - **Orquestrador Agentic** (cérebro central)
  - **5 Sub-Agentes**: Collector, Analyst, Risk Detector, Report Gen, Crisis Bot
  - **Camada MCP** (Model Context Protocol)
  - **Segurança/LGPD** (anonimização, auditoria imutável, criptografia AES-256)
  - **Memória Híbrida** (vetorial + relacional)
  - **Skill Registry** (biblioteca de habilidades)

### O que deu certo
- Arquitetura bem definida serviu de guia para toda a implementação
- Separação em agentes facilitou a evolução paralela

### O que deu errado
- Documento inicial muito focado em SETUR/CE (cliente específico) em vez de plataforma genérica
- Isso gerou retrabalho para remover referências depois

---

## Fase 2 — Core da Plataforma

### O que foi feito
- `src/types/index.ts` — Tipos e interfaces fundamentais
- `src/utils/index.ts` — Logger (Pino), criptografia (CryptoJS/AES-256), helpers
- `src/memory/index.ts` — Gerenciador de Memória Híbrida (VectorMemory + RelationalMemory)
- `src/core/orchestrator.ts` — Orquestrador Agentic (decomposição de objetivos, ciclo de vida de tarefas)
- `src/core/agent-manager.ts` — Gerenciador de sub-agentes
- `src/core/skill-registry.ts` — 6 habilidades registradas
- `src/security/anonymizer.ts` — Anonimizador LGPD (CPF, CNPJ, RG, telefone, CEP, email, nomes)
- `src/security/audit.ts` — Logs de auditoria imutáveis com hash chain
- `src/security/index.ts` — Security Manager unificado
- `src/mcp/index.ts` — MCP Bridge (8 endpoints, rate limiting, health check)
- `src/skills/handlers.ts` — Handlers das habilidades
- `src/skills/index.ts` — Registro centralizado
- `src/agents/base-agent.ts` — Classe abstrata base
- `src/agents/analyst/index.ts` — NLP: análise de sentimento (léxico PT-BR), extração de entidades, tópicos
- `src/agents/risk-detector/index.ts` — Z-Score, similaridade histórica, predição de propagação
- `src/agents/crisis-bot/index.ts` — 4 protocolos de crise, alertas multicanal
- `src/index.ts` — Demonstração do fluxo completo

### O que deu certo
- Arquitetura de agentes funcionou bem desde o início
- Logs de auditoria imutáveis com hash chain são robustos
- Anonimizador LGPD completo e funcional

### O que deu errado
- AgentManager não estava sincronizado com o Orchestrator (cada um criava o seu)
- **Correção:** Orchestrator passou a aceitar AgentManager por construtor
- Relatório truncado e sem dados reais (menções simuladas)
- Fluxo de dados entre subtarefas não funcionava (cada agente recebia dados vazios)
- **Correção:** Implementado `accumulatedResults` para passar dados entre tarefas

### Commits
- `350e152` — Implementação inicial com estrutura completa
- `cd772d7` — Correção do encadeamento de dados entre agentes

---

## Fase 3 — Frontend e Deploy

### O que foi feito
- `src/api/server.ts` — Servidor Express com rotas REST (health, dashboard, monitor, relatórios)
- `src/start.ts` — Entrypoint de produção
- Frontend React + Vite com dashboard
- `Dockerfile` — Multi-stage build
- `render.yaml` — Configuração de deploy no Render
- `.github/workflows/deploy.yml` — GitHub Actions para deploy automático

### O que deu certo
- Frontend funcional com dashboard executivo
- Deploy no Render bem-sucedido após correções
- GitHub Actions configurado

### O que deu errado
- Express 5 causava crash no Render (Node 20 Linux)
  - **Correção:** Downgrade para Express 4 (4.21.x)
- Rota `'*'` do Express 5 quebrava (wildcard path)
  - **Correção:** Substituído por middleware `app.use()` com fallback SPA
- BuildCommand inicial `tsc && cd frontend && npm install && npm run build` não funcionava no Linux
  - **Correção:** Separado em scripts `build:backend` e `build:frontend` + `build.sh`
- Dockerfile desnecessário (Render já tem suporte Node nativo)
  - **Correção:** Removido Dockerfile
- Caminho do frontend compilado (`__dirname`) incorreto em produção
  - **Correção:** Resolução inteligente com fallback em 3 caminhos possíveis

### Commits
- `96ff7ac` — Downgrade Express 5 → 4
- `da01e9d` — Script de build e correção de caminhos
- `da9e4b2` — GitHub Actions com deploy hook

---

## Fase 4 — Modelo Comercial SaaS

### O que foi feito
- `src/db/index.ts` — SQLite via better-sqlite3 com schema completo
- `src/auth/index.ts` — Autenticação JWT multi-tenant (register, login, invite)
- Modelos: Tenants (clientes), Users, Projects, Tasks, Invoices
- Rotas: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- CRUD de projetos por cliente
- Monitoramento isolado por projeto

### O que deu certo
- Modelo multi-tenant funcional desde a primeira versão
- JWT com expiração de 24h
- Projeto padrão criado automaticamente no registro

### O que deu errado
- `FOREIGN KEY constraint failed` ao criar projetos no Render
  - **Causa:** Banco existente com schema antigo (FOREIGN KEYs ativas)
  - **Tentativa 1:** Remover constraints do CREATE TABLE (não funcionou, tabelas já existiam)
  - **Tentativa 2:** `PRAGMA foreign_keys = OFF` (não funcionou, constraints ainda no schema)
  - **Solução final:** Migration que recria tabelas sem FK, transferindo dados
  - `27f7da7` — Correção inicial
  - `f3d3174` — Migration definitiva com recriação de tabelas

---

## Fase 5 — Relatório Analítico e Persistência

### O que foi feito
- `src/agents/report-gen/index.ts` — Relatório analítico completo (13.000+ caracteres)
- `src/agents/collector/index.ts` — Menções contextualizadas baseadas no objetivo real
- `src/db/index.ts` — Tabelas `mention_records`, `project_tasks`, `reports`
- `src/core/orchestrator.ts` — Persistência de menções, análises e assessments no banco
- Rotas de histórico: `GET /api/projects/:id/history`, `GET /api/projects/:id/mentions`
- Exportação PDF via PDFKit: `GET /api/reports/:id/pdf`, `POST /api/reports/export-pdf`

### O que deu certo
- Relatório detalhado com autor, plataforma, link, engajamento, sentimento, risco
- Persistência funcional no SQLite
- PDF gerado com formatação básica

### O que deu errado
- Report Gen não recebia dados dos agentes anteriores
  - **Correção:** Implementado accumulatedResults no Orchestrator
- Menções do Collector falavam de "turismo no Ceará" mesmo para "Prefeitura de BH"
  - **Correção:** `extractContext()` extrai entidade e localização do objetivo
- Relatório chegava como JSON puro no frontend
  - **Correção:** `renderMarkdown()` converte para HTML formatado

### Comando para gerar PDF
```bash
curl -X POST https://redes-sociais-monitor.onrender.com/api/reports/export-pdf \
  -H "Content-Type: application/json" \
  -d '{"objective":"RELATORIO DE REPUTACAO DA PREFEITURA DE BH"}' \
  --output relatorio.pdf
```

---

## Fase 6 — Identidade Visual Midia Monitor

### O que foi feito
- Identidade visual Techlicense (dark mode, verde neon #a3e635, Inter + JetBrains Mono)
- Tela de login/cadastro com identidade Techlicense
- Sidebar com navegação entre 5 seções
- Dashboard com métricas em tempo real
- Página de projetos com CRUD e monitoramento
- Terminal estilo CLI com logs ao vivo
- Página de configuração com planos de assinatura
- Badge "By Techlicense" em todo o layout

### O que deu certo
- Visual profissional e consistente com a marca Techlicense
- Terminal com estilo dev-first agradou
- Sidebar responsiva

### O que deu errado
- `"> "` no JSX causava erro de compilação (interpretado como fechamento de tag)
  - **Correção:** Substituir por `{'> '}` em todos os componentes

---

## Fase 7 — Conectores Reais e Barramento de Validação

### O que foi feito
- `src/connectors/base-connector.ts` — Interface IConnector + BaseConnector abstrato
- `src/connectors/twitter-connector.ts` — API v2 (Bearer Token) + fallback
- `src/connectors/instagram-connector.ts` — Graph API (Access Token + Business ID) + fallback
- `src/connectors/facebook-connector.ts` — Graph API (Access Token) + fallback
- `src/connectors/youtube-connector.ts` — Data API v3 (API Key) + fallback
- `src/connectors/news-rss-connector.ts` — RSS feeds (G1, UOL) + fallback
- `src/connectors/connector-manager.ts` — Gerenciamento centralizado
- `src/validation/data-integrity.ts` — Barramento de validação (bloqueia dados não verificáveis)
- Rotas: `GET /api/connectors/status`, `POST /api/connectors/configure`
- Persistência de credenciais no SQLite + Env Vars

### O que deu certo
- Conectores com fallback inteligente (API real > simulado > vazio)
- ConnectorManager com `connectAll()` para inicialização automática
- Barramento de validação bloqueia URLs de domínios não reconhecidos

### O que deu errado
- **Dados simulados sendo gerados mesmo com APIs configuradas** (CRÍTICO)
  - **Causa:** Collector Agent usava `fetchSimulated()` mesmo quando conectores reais existiam
  - **Solução:** `fetchFromPlatform()` agora prioriza ConnectorManager sobre simulação interna
  - `dcb3893` — Collector prioriza conectores reais
- **Links apontando para páginas que não existem** (CRÍTICO)
  - **Causa:** URLs simuladas com domínio `sample.` ou paths inventados
  - **Solução:** URLs agora usam domínios reais (x.com, instagram.com, g1.globo.com)
  - `5e147ce` — Links com domínios reais
- **Credenciais perdidas ao reiniciar o servidor** (CRÍTICO)
  - **Causa:** SQLite era efêmero no Render (deploy recria container)
  - **Solução 1:** Salvar credenciais em Environment Variables do Render
  - **Solução 2:** Render Disk montado em /data para banco persistente
  - `0484356` — Carregamento de Env Vars
  - `23c11d4` — Suporte a Render Disk
- **YouTube retornando vídeos da China, Uber, laudo médico** (CRÍTICO)
  - **Causa:** API do YouTube busca qualquer coisa que contenha uma palavra-chave
  - **Solução:** IA (Gemini/Groq) filtra menções irrelevantes
- **Twitter, Instagram e Facebook retornando 0 menções**
  - **Causa 1:** Twitter Free tem limite de 1500 posts/mês (pode ter esgotado)
  - **Causa 2:** Instagram precisa de Business ID (não configurado nas Env Vars)
  - **Causa 3:** Facebook token sem permissão de páginas
  - **Solução:** Queries expandidas com múltiplas tentativas
  - `4ef2977` — Conectores com queries expandidas
  - `c6429e3` — Twitter aceita Consumer Key + Secret

### Env Vars necessárias no Render
```
TWITTER_BEARER_TOKEN (ou TWITTER_CONSUMER_KEY + TWITTER_CONSUMER_SECRET)
INSTAGRAM_ACCESS_TOKEN (opcional, precisa de Business ID)
INSTAGRAM_BUSINESS_ID (opcional, necessário para Instagram)
FACEBOOK_ACCESS_TOKEN (opcional)
YOUTUBE_API_KEY (opcional)
ANTHROPIC_API_KEY (opcional, recomendado)
OPENAI_API_KEY (opcional)
GEMINI_API_KEY (opcional)
GROQ_API_KEY (opcional, recomendado)
```

---

## Fase 8 — IA Multi-Provedor

### O que foi feito
- `src/ai/analyzer.ts` — AI Analyzer com 4 provedores:
  - **Anthropic Claude** (Claude Sonnet 4.6) — melhor qualidade
  - **OpenAI GPT** (GPT-4o-mini) — rápido e confiável
  - **Google Gemini** (Gemini 2.0 Flash) — gratuito até certo limite
  - **Groq** (LLaMA 3.3 70B) — rápido e gratuito
- Sistema tenta cada provedor na ordem até encontrar chave configurada
- Prompt otimizado para rejeitar conteúdo irrelevante (outros idiomas, temas alheios)
- Processamento em lotes de 5 com rate limiting (300ms entre lotes)
- Integração no Collector Agent (filtra menções antes do relatório)

### O que deu certo
- Arquitetura multi-provedor flexível
- Fallback automático entre provedores

### O que deu errado
- Collector Agent só ativava IA se `ANTHROPIC_API_KEY` estivesse configurada
  - **Correção:** Agora verifica qualquer um dos 4 provedores
  - `ea75887` — Filtro IA multi-provedor corrigido
- `temIA` foi alterado para checar todos os provedores

---

## Fase 9 — Filtro por Data

### O que foi feito
- Orchestrator.submitObjective() aceita extraMetadata com startDate/endDate
- Metadados de período propagados para todas as subtarefas
- Collector usa dataInicio/dataFim ao chamar conectores (FetchOptions.since/until)
- API endpoints aceitam startDate e endDate
- Frontend com campos de data início/fim em todas as telas
- Período padrão: 7 dias atrás até agora

### O que deu certo
- Filtro funcional em todo o pipeline
- YouTube e RSS respeitam o período selecionado

### O que deu errado
- Conectores Twitter/Instagram/Facebook podem não suportar filtro por data na versão free

---

## Lições Aprendidas

### Lições Técnicas

1. **Express 5 não é estável para produção** — Use Express 4 (4.21.x) que é amplamente testado
2. **SQLite + Render** — Banco é efêmero sem Disk montado. Sempre usar Render Disk ou env vars para dados persistentes
3. **APIs de redes sociais têm limitações severas no free tier** — Twitter: 1500 posts/mês, Instagram: token 24h (modo dev)
4. **Nunca gerar dados simulados em plataforma comercial** — Sempre retornar vazio se não houver dados reais
5. **FOREIGN KEY no SQLite** — `CREATE TABLE IF NOT EXISTS` não atualiza schema existente. Usar migrations com `ALTER TABLE` ou recriação
6. **Encadeamento de dados entre agentes** — Usar accumulatedResults em vez de cada agente buscar do anterior
7. **Caminhos de arquivo em produção** — `__dirname` muda dependendo de como o script é executado. Usar `process.cwd()` como fallback

### Lições de Produto

1. **Produto comercial, não projeto específico** — Remover todas as referências a clientes específicos (SETUR/CE)
2. **IA é essencial para qualidade** — APIs de redes sociais retornam muito ruído. IA filtra o que é relevante
3. **Não simular, não inventar** — Clientes de marketing precisam de dados reais e verificáveis
4. **Múltiplos provedores de IA** — Não depender de um único fornecedor
5. **Período de busca** — Usuário precisa controlar o intervalo de tempo da busca
6. **Links reais ou nenhum** — Links quebrados destroem a credibilidade

---

## Roadmap Futuro

### Curto Prazo
- [ ] LinkedIn Connector (API oficial)
- [ ] TikTok Connector (API oficial)
- [ ] Stripe/Pagarme para assinaturas
- [ ] Dashboard com gráficos (Recharts)
- [ ] Notificações em tempo real (WebSocket)

### Médio Prazo
- [ ] Postgres (upgrade de SQLite)
- [ ] Cache Redis para acelerar buscas repetidas
- [ ] White-label completo (cliente pode usar próprio domínio)
- [ ] App mobile (React Native)
- [ ] Integração com WhatsApp Business API

### Longo Prazo
- [ ] Modelo de IA próprio (fine-tune) para análise de reputação
- [ ] Detecção de crise em tempo real
- [ ] Sugestão automática de respostas para crises
- [ ] Integração com Google Analytics e ferramentas de mídia paga

---

## Estrutura do Projeto

```
📁 Redes_sociais_monitor/
├── 📄 package.json, tsconfig.json, jest.config.js
├── 📄 render.yaml                    # Configuracao de deploy Render
├── 📄 build.sh                       # Script de build
├── 📄 .env.example, .env.production
├── 📁 .github/workflows/
│   └── 📄 deploy.yml                 # GitHub Actions
├── 📁 data/                          # SQLite persistente (Render Disk)
├── 📁 docs/
│   ├── 📄 arquitetura_tecnica_detalhada.png
│   ├── 📄 Detalhamento da Arquitetura Técnica_*.md
│   └── 📄 HISTORICO_DESENVOLVIMENTO.md
├── 📁 frontend/
│   ├── 📄 vite.config.ts
│   ├── 📁 src/
│   │   ├── 📄 App.tsx                # Componente principal
│   │   ├── 📄 main.tsx               # Entrypoint
│   │   ├── 📄 index.css              # Tema Techlicense
│   │   ├── 📁 components/
│   │   │   ├── 📄 Sidebar.tsx
│   │   │   ├── 📄 MetricCard.tsx
│   │   │   └── 📄 Terminal.tsx
│   │   ├── 📁 pages/
│   │   │   ├── 📄 LoginPage.tsx      # Login + Cadastro
│   │   │   ├── 📄 DashboardPage.tsx
│   │   │   ├── 📄 ProjectsPage.tsx
│   │   │   ├── 📄 MonitorPage.tsx
│   │   │   ├── 📄 ReportsPage.tsx
│   │   │   └── 📄 SettingsPage.tsx
│   │   └── 📁 lib/
│   │       └── 📄 api.ts             # API client
│   └── 📁 dist/                      # Build (gitignored)
└── 📁 src/
    ├── 📄 index.ts                   # Demo
    ├── 📄 start.ts                   # Entrypoint producao
    ├── 📁 types/
    │   └── 📄 index.ts               # Interfaces globais
    ├── 📁 utils/
    │   └── 📄 index.ts               # Logger, criptografia, helpers
    ├── 📁 core/
    │   ├── 📄 orchestrator.ts        # Orquestrador Agentic
    │   ├── 📄 agent-manager.ts       # Gerenciador de agentes
    │   └── 📄 skill-registry.ts      # Registro de habilidades
    ├── 📁 agents/
    │   ├── 📄 base-agent.ts
    │   ├── 📁 collector/             # Coleta de dados (multi-plataforma)
    │   ├── 📁 analyst/               # NLP: sentimento, entidades, topicos
    │   ├── 📁 risk-detector/         # Z-Score, similaridade historica
    │   ├── 📁 report-gen/            # Relatorios analiticos + PDF
    │   └── 📁 crisis-bot/            # Protocolos de crise
    ├── 📁 memory/
    │   └── 📄 index.ts               # Memoria hibrida (vetorial + relacional)
    ├── 📁 mcp/
    │   └── 📄 index.ts               # Model Context Protocol bridge
    ├── 📁 security/
    │   ├── 📄 anonymizer.ts          # LGPD: CPF, CNPJ, email, telefone
    │   ├── 📄 audit.ts              # Logs imutaveis com hash chain
    │   └── 📄 index.ts              # Security Manager
    ├── 📁 connectors/
    │   ├── 📄 base-connector.ts      # Interface padrao
    │   ├── 📄 connector-manager.ts   # Gerenciamento centralizado
    │   ├── 📄 twitter-connector.ts   # API v2 + Consumer Key/Secret
    │   ├── 📄 instagram-connector.ts # Graph API
    │   ├── 📄 facebook-connector.ts  # Graph API
    │   ├── 📄 youtube-connector.ts   # Data API v3
    │   └── 📄 news-rss-connector.ts  # RSS G1, UOL
    ├── 📁 ai/
    │   └── 📄 analyzer.ts           # IA multi-provedor
    ├── 📁 validation/
    │   └── 📄 data-integrity.ts     # Barramento de validacao
    ├── 📁 skills/
    │   ├── 📄 handlers.ts            # Handlers das habilidades
    │   └── 📄 index.ts              # Registro
    ├── 📁 auth/
    │   └── 📄 index.ts              # JWT multi-tenant
    ├── 📁 db/
    │   └── 📄 index.ts              # SQLite + migrations
    └── 📁 api/
        └── 📄 server.ts             # Express server + rotas
```

---

## Endpoints da API

### Públicos
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/register` | Criar conta (cliente + admin) |
| POST | `/api/auth/login` | Login |

### Autenticados (Bearer Token)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/auth/me` | Dados do usuário + tenant + projetos |
| POST | `/api/projects` | Criar projeto |
| GET | `/api/projects` | Listar projetos |
| GET | `/api/projects/:id` | Detalhes do projeto |
| POST | `/api/projects/:id/monitor` | Monitorar projeto |
| GET | `/api/projects/:id/history` | Histórico do projeto |
| GET | `/api/projects/:id/mentions` | Menções do projeto |
| POST | `/api/reports/generate` | Gerar relatório |
| GET | `/api/reports/list` | Listar relatórios |
| POST | `/api/reports/export-pdf` | Exportar PDF |
| POST | `/api/connectors/configure` | Configurar API Keys |
| GET | `/api/connectors/status` | Status dos conectores + IAs |
| GET | `/api/diagnostics/test-connectors` | Testar conectores |
| GET | `/api/validation/report` | Relatório de rejeições |
| POST | `/api/simulate/crisis` | Simular crise |
| POST | `/api/anonymize` | Anonimizar texto |

---

## Comandos Úteis

### Testar registro
```bash
curl -X POST https://redes-sociais-monitor.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Agência Exemplo","slug":"agencia-exemplo","adminName":"João","adminEmail":"joao@email.com","adminPassword":"123456"}'
```

### Testar login
```bash
curl -X POST https://redes-sociais-monitor.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"joao@email.com","password":"123456"}'
```

### Testar conectores (diagnóstico)
```bash
curl https://redes-sociais-monitor.onrender.com/api/diagnostics/test-connectors
```

### Gerar relatório com período
```bash
curl -X POST https://redes-sociais-monitor.onrender.com/api/reports/generate \
  -H "Content-Type: application/json" \
  -d '{"objective":"RELATORIO PREFEITURA BH","startDate":"2026-05-20","endDate":"2026-05-26"}'
```

### Baixar PDF
```bash
curl -X POST https://redes-sociais-monitor.onrender.com/api/reports/export-pdf \
  -H "Content-Type: application/json" \
  -d '{"objective":"RELATORIO PREFEITURA BH"}' --output relatorio.pdf
```

---

*Documento gerado em 26/05/2026 — Midia Monitor By Techlicense*
