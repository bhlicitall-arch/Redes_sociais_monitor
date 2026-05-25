/**
 * Tipos base da Plataforma Agentic de Monitoramento Superior
 *
 * Define as interfaces fundamentais compartilhadas entre todos os
 * componentes: orquestrador, agentes, MCP, segurança e memória.
 */

// ============================================================
// Identificadores Universais
// ============================================================

export type EntityId = string;   // UUID v4

// ============================================================
// Metadados de Fonte (origem da menção)
// ============================================================

export type MediaPlatform =
  | 'twitter'
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'tiktok'
  | 'youtube'
  | 'news_portal'
  | 'blog'
  | 'forum'
  | 'radio'
  | 'tv'
  | 'whatsapp'
  | 'other';

export interface SourceMetadata {
  platform: MediaPlatform;
  url?: string;
  author?: string;
  authorId?: string;
  timestamp: Date;
  language: string;
  region?: string;
  engagement?: {
    likes: number;
    shares: number;
    comments: number;
    views?: number;
  };
}

// ============================================================
// Menção (dado bruto coletado)
// ============================================================

export interface Mention {
  id: EntityId;
  source: SourceMetadata;
  rawContent: string;
  mediaAttachments?: MediaAttachment[];
  collectedAt: Date;
}

export interface MediaAttachment {
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  mimeType: string;
  hash?: string;
}

// ============================================================
// Resultado da Análise
// ============================================================

export type SentimentLabel = 'positive' | 'neutral' | 'negative' | 'very_negative' | 'very_positive';

export interface AnalysisResult {
  mentionId: EntityId;
  sentiment: SentimentLabel;
  sentimentScore: number;          // -1.0 a +1.0
  topics: string[];
  entities: ExtractedEntity[];
  summary: string;
  isRelevant: boolean;
  relevanceScore: number;          // 0.0 a 1.0
  analyzedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface ExtractedEntity {
  name: string;
  type: 'person' | 'organization' | 'location' | 'event' | 'product' | 'regulation' | 'other';
  confidence: number;
}

// ============================================================
// Avaliação de Risco
// ============================================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskAssessment {
  mentionId: EntityId;
  riskLevel: RiskLevel;
  riskScore: number;               // 0.0 a 1.0
  contributingFactors: RiskFactor[];
  historicalContext?: string;
  predictedSpread?: number;        // 0.0 a 1.0 (probabilidade de propagação)
  assessedAt: Date;
}

export interface RiskFactor {
  name: string;
  weight: number;
  description: string;
}

// ============================================================
// Alertas e Respostas a Crises
// ============================================================

export interface Alert {
  id: EntityId;
  triggeredAt: Date;
  riskAssessmentId: EntityId;
  channels: AlertChannel[];
  message: string;
  severity: RiskLevel;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  crisisProtocolId?: EntityId;
}

export type AlertChannel = 'email' | 'sms' | 'slack' | 'whatsapp' | 'webhook' | 'dashboard';

export interface CrisisProtocol {
  id: EntityId;
  name: string;
  description: string;
  triggerConditions: RiskCondition[];
  steps: CrisisStep[];
  approved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrisisStep {
  order: number;
  action: string;
  responsibleRole: string;
  expectedOutcome: string;
  timeoutMinutes: number;
  escalationContact?: string;
}

export interface RiskCondition {
  field: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'in' | 'contains';
  value: unknown;
}

// ============================================================
// Tarefas e Subtarefas (Orquestração)
// ============================================================

export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  id: EntityId;
  parentTaskId?: EntityId;
  objective: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedAgent?: AgentType;
  subtasks: Task[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: TaskResult;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface TaskResult {
  success: boolean;
  data?: unknown;
  summary: string;
  metrics?: Record<string, number>;
}

export type AgentType =
  | 'orchestrator'
  | 'collector'
  | 'analyst'
  | 'risk_detector'
  | 'report_gen'
  | 'crisis_bot';

// ============================================================
// Habilidades (Skill Registry)
// ============================================================

export interface Skill {
  id: EntityId;
  name: string;
  description: string;
  agentType: AgentType;
  parameters: SkillParameter[];
  handler: string;                 // path para o módulo handler
  version: string;
  enabled: boolean;
}

export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  defaultValue?: unknown;
}

// ============================================================
// Memória
// ============================================================

export interface MemoryEntry {
  id: EntityId;
  type: 'semantic' | 'episodic' | 'procedural';
  content: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
  timestamp: Date;
  ttl?: number;                    // dias para expiração
}

export interface HistoricalCrisisRecord {
  id: EntityId;
  crisisId: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  timeline: CrisisEvent[];
  resolution: string;
  lessonsLearned: string[];
  occurredAt: Date;
  resolvedAt?: Date;
}

export interface CrisisEvent {
  timestamp: Date;
  eventType: string;
  description: string;
  actionTaken?: string;
}

// ============================================================
// Relatórios
// ============================================================

export type ReportFormat = 'markdown' | 'pdf' | 'json' | 'html';

export interface ReportConfig {
  title: string;
  format: ReportFormat;
  timeRange: { start: Date; end: Date };
  sections: ReportSection[];
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    organizationName?: string;
  };
}

export interface ReportSection {
  title: string;
  type: 'summary' | 'sentiment_analysis' | 'risk_assessment' | 'volume_trends' | 'top_mentions' | 'recommendations' | 'custom';
  data: unknown;
  visualizations?: VisualizationDef[];
}

export interface VisualizationDef {
  type: 'line_chart' | 'bar_chart' | 'pie_chart' | 'heatmap' | 'wordcloud';
  title: string;
  data: unknown;
  options?: Record<string, unknown>;
}

// ============================================================
// Mensagens MCP
// ============================================================

export interface MCPMessage {
  id: EntityId;
  source: AgentType;
  target: AgentType | 'mcp_bridge';
  type: 'request' | 'response' | 'event' | 'command';
  action: string;
  payload: unknown;
  timestamp: Date;
  correlationId?: EntityId;
}

// ============================================================
// Configuração Global
// ============================================================

export interface PlatformConfig {
  port: number;
  nodeEnv: string;
  encryptionKey: string;
  logLevel: string;
  auditLogPath: string;
  vectorMemoryType: 'memory' | 'pinecone' | 'weaviate';
  mcpServerPort: number;
  socialMedia: {
    twitter?: { bearerToken: string };
    instagram?: { accessToken: string };
    linkedin?: { accessToken: string };
    tiktok?: { accessToken: string };
  };
}

// ============================================================
// Logs de Auditoria
// ============================================================

export interface AuditLogEntry {
  id: EntityId;
  timestamp: Date;
  agentType: AgentType;
  action: string;
  resourceType: string;
  resourceId: string;
  details: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  immutable: true;                 // sempre true após persistido
  previousHash: string;
  hash: string;
}
