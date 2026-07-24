export type RealtimeEventType =
  | 'heartbeat'
  | 'connected'
  | 'monitor.updated'
  | 'incident.changed'
  | 'agent.updated'
  | 'alert.delivered'
  | 'ping.cycle'
  | 'vigia.action'
  | 'vigia.round';

export interface RealtimeEvent {
  type: RealtimeEventType;
  at: string;
  payload?: Record<string, unknown>;
}

export type RealtimeSubscriber = (event: RealtimeEvent) => void;

/**
 * Pub/sub in-memory por userId.
 * Adequado a um processo; com múltiplas instâncias no futuro → Redis/NATS.
 */
export class RealtimeHub {
  private readonly rooms = new Map<string, Set<RealtimeSubscriber>>();

  subscribe(userId: string, subscriber: RealtimeSubscriber): () => void {
    let set = this.rooms.get(userId);
    if (!set) {
      set = new Set();
      this.rooms.set(userId, set);
    }
    set.add(subscriber);

    return () => {
      const current = this.rooms.get(userId);
      if (!current) return;
      current.delete(subscriber);
      if (current.size === 0) this.rooms.delete(userId);
    };
  }

  publish(userId: string, event: Omit<RealtimeEvent, 'at'> & { at?: string }): void {
    const set = this.rooms.get(userId);
    if (!set || set.size === 0) return;

    const full: RealtimeEvent = {
      ...event,
      at: event.at ?? new Date().toISOString(),
    };

    for (const sub of set) {
      try {
        sub(full);
      } catch {
        // isolado — um subscriber quebrado não derruba os demais
      }
    }
  }

  publishMany(
    userIds: Iterable<string>,
    event: Omit<RealtimeEvent, 'at'> & { at?: string }
  ): void {
    const seen = new Set<string>();
    for (const id of userIds) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      this.publish(id, event);
    }
  }

  subscriberCount(userId?: string): number {
    if (userId) return this.rooms.get(userId)?.size ?? 0;
    let n = 0;
    for (const set of this.rooms.values()) n += set.size;
    return n;
  }
}

export const realtimeHub = new RealtimeHub();
