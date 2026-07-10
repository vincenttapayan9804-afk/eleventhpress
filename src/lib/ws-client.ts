/**
 * WebSocket emit helper — called from API routes to broadcast real-time
 * events to connected dashboard clients via the ws-service mini-service.
 *
 * The ws-service runs on port 3003 and exposes POST /emit.
 */

const WS_SERVICE_URL = "http://localhost:3003/emit";

export interface WSEvent {
  event: string;
  room?: string;
  data: any;
}

/**
 * Broadcast an event to all connected clients (or a specific room).
 * Non-blocking — if the ws-service is down, the event is silently dropped.
 */
export async function emitWS(event: string, data: any, room?: string): Promise<void> {
  try {
    await fetch(WS_SERVICE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, data, room }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // ws-service may be down; events are best-effort
  }
}

/** Emit to all editors. */
export function emitToEditors(event: string, data: any): Promise<void> {
  return emitWS(event, data, "editors");
}

/** Emit to a specific user. */
export function emitToUser(userId: string, event: string, data: any): Promise<void> {
  return emitWS(event, data, `user:${userId}`);
}

/** Emit to a specific article's subscribers. */
export function emitToArticle(articleId: string, event: string, data: any): Promise<void> {
  return emitWS(event, data, `article:${articleId}`);
}
