/**
 * EJAZ Transport — Authoritative Trip Status Writer
 *
 * The ONLY place a trip's lifecycle state may change. Every caller (the
 * console, the driver app, the finance settlement, the approval queue) goes
 * through here, so:
 *
 *  • the state machine is validated on every hop — no status is ever skipped;
 *  • every hop produces a `TripEventEntity` (the trip's own audit trail);
 *  • every hop produces an audit-log entry with the acting user;
 *  • every hop notifies the parties that follow the trip.
 *
 * Nothing else in the server assigns to `trip.status`.
 */

import { db, type TripEntity, type TripEventEntity } from "../db";
import {
  planTransition,
  STATUS_LABELS,
  type TripLifecycleStatus,
} from "./tripLifecycleService";
import { logAuditEvent } from "./auditService";
import { dispatchNotification } from "./notificationService";

export interface StatusActor {
  userId?: string;
  fullName?: string;
  role?: string;
}

export interface ApplyStatusResult {
  ok: boolean;
  error?: string;
  code?: string;
  /** The states actually written, in order. */
  applied: TripLifecycleStatus[];
  trip?: TripEntity;
}

/** Writes one hop: state + event + audit + notification. */
function writeHop(
  trip: TripEntity,
  from: TripLifecycleStatus,
  to: TripLifecycleStatus,
  actor: StatusActor,
  notes?: string,
  reason?: string,
  coordinates?: { latitude?: number; longitude?: number }
): TripEventEntity {
  trip.status = to;
  trip.updatedAt = new Date().toISOString();
  if (coordinates?.latitude && coordinates?.longitude) {
    trip.currentLat = coordinates.latitude;
    trip.currentLng = coordinates.longitude;
  }

  const event: TripEventEntity = {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tripId: trip.id,
    eventType: "STATUS_TRANSITION",
    fromStatus: from,
    toStatus: to,
    actorId: actor.userId,
    actorName: actor.fullName,
    actorRole: actor.role,
    notes: notes || reason || `Transitioned from ${from} to ${to}`,
    latitude: coordinates?.latitude || trip.currentLat,
    longitude: coordinates?.longitude || trip.currentLng,
    timestamp: new Date().toISOString(),
  };
  db.tripEvents.push(event);

  logAuditEvent({
    actorId: actor.userId,
    actorName: actor.fullName,
    actorRole: actor.role,
    action: "TRIP_STATUS_TRANSITION",
    entity: "trips",
    entityId: trip.id,
    tripId: trip.id,
    oldValues: { status: from },
    newValues: { status: to, notes },
    reason,
  });

  dispatchNotification({
    targetRole: "ALL",
    titleAr: `تحديث مسار الرحلة ${trip.tripNumber}`,
    titleEn: `Trip Status Update: ${trip.tripNumber}`,
    messageAr: `تم تحديث حالة الرحلة إلى: ${STATUS_LABELS[to]?.ar || to}`,
    messageEn: `Trip transitioned to: ${STATUS_LABELS[to]?.en || to}`,
    type: "SUCCESS",
    entityType: "trip",
    entityId: trip.id,
    tripId: trip.id,
  });

  return event;
}

/**
 * Advances a trip to `targetStatus`, walking every intermediate canonical state
 * in order. Returns the full chain that was written so the caller can show the
 * operator exactly what happened («CONFIRMED → ASSIGNED → … → IN_TRANSIT»).
 */
export function advanceTripStatus(
  trip: TripEntity,
  targetStatus: TripLifecycleStatus,
  actor: StatusActor,
  opts: {
    notes?: string;
    reason?: string;
    latitude?: number;
    longitude?: number;
    /** Trip data used for the required-field checks of each hop. */
    tripData?: Record<string, any>;
  } = {}
): ApplyStatusResult {
  const role = actor.role || "GUEST";
  const plan = planTransition(
    trip.status as TripLifecycleStatus,
    targetStatus,
    role,
    opts.tripData ?? (trip as unknown as Record<string, any>),
    opts.reason || opts.notes
  );

  if (!plan.ok) {
    return {
      ok: false,
      error: plan.error,
      code: "INVALID_TRANSITION",
      applied: [],
      trip,
    };
  }

  const applied: TripLifecycleStatus[] = [];
  let previous = trip.status as TripLifecycleStatus;

  for (const hop of plan.path) {
    writeHop(trip, previous, hop, actor, opts.notes, opts.reason, {
      latitude: opts.latitude,
      longitude: opts.longitude,
    });
    applied.push(hop);
    previous = hop;
  }

  return { ok: true, applied, trip };
}

/** Cancels a trip with a mandatory reason, recording the event chain. */
export function cancelTripStatus(
  trip: TripEntity,
  actor: StatusActor,
  reason: string
): ApplyStatusResult {
  const from = trip.status as TripLifecycleStatus;
  trip.status = "CANCELLED";
  trip.updatedAt = new Date().toISOString();
  trip.cancellationReason = reason;

  const event: TripEventEntity = {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tripId: trip.id,
    eventType: "STATUS_TRANSITION",
    fromStatus: from,
    toStatus: "CANCELLED",
    actorId: actor.userId,
    actorName: actor.fullName,
    actorRole: actor.role,
    notes: reason,
    latitude: trip.currentLat,
    longitude: trip.currentLng,
    timestamp: new Date().toISOString(),
  };
  db.tripEvents.push(event);

  logAuditEvent({
    actorId: actor.userId,
    actorName: actor.fullName,
    actorRole: actor.role,
    action: "TRIP_CANCELLED",
    entity: "trips",
    entityId: trip.id,
    tripId: trip.id,
    oldValues: { status: from },
    newValues: { status: "CANCELLED" },
    reason,
  });

  return { ok: true, applied: ["CANCELLED"], trip };
}
