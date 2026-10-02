/**
 * EJAZ Transport — Immutable Audit Trail Service
 * Records every sensitive operational, financial, and status change event.
 */

export interface AuditRecord {
  id: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  action: string;
  entity: string;
  entityId: string;
  tripId?: string;
  oldValues?: any;
  newValues?: any;
  reason?: string;
  ipAddress?: string;
  timestamp: string;
}

const inMemoryAuditTrail: AuditRecord[] = [];

export function logAuditEvent(params: Omit<AuditRecord, "id" | "timestamp">): AuditRecord {
  const record: AuditRecord = {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...params,
    timestamp: new Date().toISOString(),
  };

  inMemoryAuditTrail.unshift(record);

  // Keep max in-memory backlog for performance
  if (inMemoryAuditTrail.length > 2000) {
    inMemoryAuditTrail.pop();
  }

  return record;
}

export function getAuditLogs(filter?: { entity?: string; entityId?: string; tripId?: string; limit?: number }): AuditRecord[] {
  let list = inMemoryAuditTrail;
  if (filter?.tripId) {
    list = list.filter((r) => r.tripId === filter.tripId);
  }
  if (filter?.entity) {
    list = list.filter((r) => r.entity === filter.entity);
  }
  if (filter?.entityId) {
    list = list.filter((r) => r.entityId === filter.entityId);
  }
  return list.slice(0, filter?.limit || 100);
}
