/**
 * Plataforma Agentic de Monitoramento Superior
 * =============================================
 *
 * Ponto de entrada da plataforma — inicializa todos os componentes:
 * 1. Orquestrador Agentic (cérebro central)
 * 2. Ecossistema de Sub-Agentes
 * 3. Camada MCP de Integração
 * 4. Segurança/Privacidade (LGPD)
 * 5. Memória Híbrida
 * 6. Habilidades (Skill Registry)
 *
 * Fluxo de Operação:
 *   Ingestão → Triagem → Risco → Alerta/Ação → Aprendizado
 */

import { Orchestrator } from './core/orchestrator';
import { SkillRegistry } from './core/skill-registry';
import { AgentManager } from './core/agent-manager';
import { CollectorAgent } from './agents/collector';
import { AnalystAgent } from './agents/analyst';
import { RiskDetectorAgent } from './agents/risk-detector';
import { ReportGenAgent } from './agents/report-gen';
import { CrisisBotAgent } from './agents/crisis-bot';
import { mcpBridge } from './mcp';
import { securityManager } from './security';
import { memoryManager } from './memory';
import { initializeSkills } from './skills';
import { logger, loadConfig } from './utils';

// ============================================================
// Demonstração Completa da Plataforma
// ============================================================

async function main(): Promise<void> {
  // ASCII Art — Identidade Visual
  console.log(`
  ╔══════════════════════════════════════════════════════════════╗
  ║                                                              ║
  ║   PLATAFORMA AGENTIC DE MONITORAMENTO SUPERIOR              ║
  ║   MIDIA MONITOR — By Techlicense       ║
  ║                                                              ║
  ║   "Orquestrador Agentic · Sub-Agentes · MCP · LGPD"         ║
  ║                                                              ║
  ╚══════════════════════════════════════════════════════════════╝
  `);

  const config = loadConfig();
  logger.info({ nodeEnv: config.nodeEnv, port: config.port }, 'Starting platform');

  // 1. Inicializa componentes core
  const skillRegistry = new SkillRegistry();
  const agentManager = new AgentManager();
  const securityAudit = securityManager.auditLogger;
  const orchestrator = new Orchestrator(agentManager, securityAudit);

  // 2. Registra handlers das habilidades
  initializeSkills(skillRegistry);

  // 3. Instancia e registra sub-agentes
  const collector = new CollectorAgent();
  const analyst = new AnalystAgent();
  const riskDetector = new RiskDetectorAgent();
  const reportGen = new ReportGenAgent();
  const crisisBot = new CrisisBotAgent();

  agentManager.registerAgent(collector);
  agentManager.registerAgent(analyst);
  agentManager.registerAgent(riskDetector);
  agentManager.registerAgent(reportGen);
  agentManager.registerAgent(crisisBot);

  logger.info('All agents registered successfully');

  // 4. Conecta MCP (simulado)
  logger.info('Establishing MCP connections...');
  await mcpBridge.connectPlatform('twitter');
  await mcpBridge.connectPlatform('instagram');
  await mcpBridge.connectPlatform('news_portal');
  logger.info('MCP connections established');

  // 5. Log de inicialização no audit
  await securityManager.logAudit({
    agentType: 'orchestrator',
    action: 'platform_initialized',
    resourceType: 'system',
    resourceId: 'platform',
    details: 'Plataforma Agentic de Monitoramento Superior inicializada',
    severity: 'info',
  });

  // ============================================================
  // Demonstração do Fluxo Completo
  // ============================================================
  console.log('\n📋 Iniciando demonstração do fluxo de operação...\n');

  const demoObjective =
    'Monitore a reputação da Prefeitura de Belo Horizonte';

  console.log('🎯 Objetivo:', demoObjective, '\n');
  console.log('────────────────────────────────────────────\n');

  // Executa o ciclo completo
  const rootTask = await orchestrator.submitObjective(demoObjective, 'high');

  // Aguarda conclusão
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Exibe resultados
  console.log('\n────────────────────────────────────────────\n');
  console.log('✅ Fluxo concluído!\n');

  const completedTask = orchestrator.getTaskStatus(rootTask.id);
  if (completedTask) {
    console.log('📊 Resultado da Tarefa Principal:');
    console.log(`   Status: ${completedTask.status}`);
    console.log(`   Resumo: ${completedTask.result?.summary}`);

    console.log('\n📋 Subtarefas:');
    for (const subtask of completedTask.subtasks) {
      const statusIcon = subtask.status === 'completed' ? '✅' : '❌';
      console.log(`   ${statusIcon} [${subtask.assignedAgent}] ${subtask.objective.slice(0, 80)}...`);
      if (subtask.result) {
        console.log(`      → ${subtask.result.summary}`);
      }
    }
  }

  // 7. Gera relatório final
  console.log('\n📄 Relatório Gerado:');
  const reportSubtask = completedTask?.subtasks.find((t) => t.assignedAgent === 'report_gen');
  if (reportSubtask?.result?.data) {
    const reportData = reportSubtask.result.data as { content?: string };
    if (reportData.content) {
      console.log('\n' + reportData.content.slice(0, 1000) + '...\n');
    }
  }

  // 8. Verifica integridade da auditoria
  const auditStatus = securityManager.verifyAuditIntegrity();
  console.log(`\n🔒 Auditoria: ${auditStatus.valid ? '✅ Cadeia íntegra' : '❌ Violação detectada'}`);

  // 9. Estado da memória
  console.log(`\n🧠 Memória: ${memoryManager.vector.getAll().length} entradas semânticas + ${memoryManager.relational.searchCrisesByKeyword('').length} registros históricos`);

  // 10. Estado MCP
  const mcpHealth = await mcpBridge.healthCheck();
  console.log(`\n🔌 MCP: ${Object.entries(mcpHealth).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  // 11. Anonimização de exemplo
  console.log('\n🔐 Exemplo de Anonimização LGPD:');
  const sampleText = 'O CPF 123.456.789-00 do cidadão João Silva de Fortaleza/CE foi mencionado. Email: joao@email.com';
  const anonymized = securityManager.anonymizer.anonymize(sampleText, 'full');
  console.log(`   Original: ${sampleText}`);
  console.log(`   Anonimizado: ${anonymized}`);

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  🚀 Plataforma operacional!');
  console.log('  5 agentes · 6 habilidades · MCP ativo · LGPD ativa');
  console.log('═══════════════════════════════════════════════════\n');
}

// ============================================================
// Execução
// ============================================================

main().catch((error) => {
  logger.error({ error }, 'Platform failed to start');
  process.exit(1);
});
