import type {
  AffectedMonitor,
  AiAnalysisStatus,
  Incident,
  IncidentAiAnalysis,
  IncidentComment,
  IncidentSeverity,
  IncidentStatus,
  IncidentTimelineEvent,
  IncidentTimelineEventType,
  UpdateIncidentInput,
} from '@analytic-pulse/shared';

export interface IncidentRow {
  id: string;
  user_id: string;
  title: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  root_cause: string | null;
  notes: string | null;
  tags: string[] | null;
  opened_at: Date | string;
  acknowledged_at: Date | string | null;
  recovered_at: Date | string | null;
  resolved_at: Date | string | null;
  acknowledged_by: string | null;
  resolved_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  ai_analysis?: IncidentAiAnalysis | Record<string, unknown> | null;
  ai_analysis_status?: AiAnalysisStatus | null;
  ai_analyzed_at?: Date | string | null;
}

export interface IncidentRepository {
  create(input: {
    userId: string;
    title: string;
    severity?: IncidentSeverity;
    monitorIds: string[];
    tags?: string[];
  }): Promise<IncidentRow>;

  findOpenByMonitor(monitorId: string): Promise<IncidentRow | null>;

  findByIdForUser(id: string, userId: string): Promise<IncidentRow | null>;

  listByUser(
    userId: string,
    filters?: { status?: IncidentStatus | 'active' | 'all' }
  ): Promise<IncidentRow[]>;

  update(
    id: string,
    userId: string,
    input: UpdateIncidentInput & {
      acknowledged_at?: string | Date | null;
      acknowledged_by?: string | null;
      recovered_at?: string | Date | null;
      resolved_at?: string | Date | null;
      resolved_by?: string | null;
    }
  ): Promise<IncidentRow | null>;

  /** Marca pending de forma atômica; retorna false se já pending/ready (auto). */
  claimAiAnalysis(
    id: string,
    userId: string,
    opts?: { force?: boolean }
  ): Promise<boolean>;

  saveAiAnalysis(
    id: string,
    userId: string,
    analysis: IncidentAiAnalysis,
    status: Extract<AiAnalysisStatus, 'ready' | 'failed' | 'skipped'>
  ): Promise<void>;

  attachMonitor(incidentId: string, monitorId: string): Promise<void>;

  getAffectedMonitors(incidentId: string): Promise<AffectedMonitor[]>;

  getAffectedMonitorsBatch(
    incidentIds: string[]
  ): Promise<Record<string, AffectedMonitor[]>>;

  addTimelineEvent(input: {
    incidentId: string;
    eventType: IncidentTimelineEventType;
    message: string;
    actorUserId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<IncidentTimelineEvent>;

  listTimeline(incidentId: string): Promise<IncidentTimelineEvent[]>;

  addComment(input: {
    incidentId: string;
    userId: string;
    body: string;
  }): Promise<IncidentComment>;

  listComments(incidentId: string): Promise<IncidentComment[]>;
}

export function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export function computeDurationMs(row: IncidentRow, now = Date.now()): number {
  const opened = new Date(row.opened_at).getTime();
  const end = row.recovered_at
    ? new Date(row.recovered_at).getTime()
    : row.resolved_at
      ? new Date(row.resolved_at).getTime()
      : now;
  return Math.max(0, end - opened);
}

function mapAiAnalysis(
  raw: IncidentRow['ai_analysis']
): IncidentAiAnalysis | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as IncidentAiAnalysis;
}

export function mapIncident(
  row: IncidentRow,
  affected: AffectedMonitor[]
): Incident {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    status: row.status,
    severity: row.severity,
    root_cause: row.root_cause,
    notes: row.notes,
    tags: row.tags ?? [],
    opened_at: toIso(row.opened_at)!,
    acknowledged_at: toIso(row.acknowledged_at),
    recovered_at: toIso(row.recovered_at),
    resolved_at: toIso(row.resolved_at),
    acknowledged_by: row.acknowledged_by,
    resolved_by: row.resolved_by,
    created_at: toIso(row.created_at)!,
    updated_at: toIso(row.updated_at)!,
    duration_ms: computeDurationMs(row),
    affected_monitors: affected,
    ai_analysis: mapAiAnalysis(row.ai_analysis),
    ai_analysis_status: row.ai_analysis_status ?? null,
    ai_analyzed_at: toIso(row.ai_analyzed_at),
  };
}
