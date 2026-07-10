/**
 * EPIP WebSocket Service — Real-time dashboard updates.
 *
 * Listens on port 3003. Uses Socket.io to push live events to connected
 * dashboard clients:
 *   - submission:new          (new article submitted)
 *   - review:completed        (reviewer submitted their review)
 *   - workflow:transition     (article moved between states)
 *   - doi:deposited           (Crossref deposit completed)
 *   - galley:generated        (production galleys ready)
 *   - notification:new        (in-app notification)
 *
 * Frontend connects via: io("/?XTransformPort=3003")
 *
 * This service also exposes a REST endpoint POST /emit that internal
 * API routes call to broadcast events.
 */
import { Server } from "socket.io";
import { createServer } from "http";

const PORT = 3003;

const httpServer = createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      service: "epip-ws-service",
      port: PORT,
      connections: io?.sockets.sockets.size || 0,
    }));
    return;
  }

  // POST /emit — internal endpoint for API routes to broadcast events
  if (req.url === "/emit" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { event, room, data } = JSON.parse(body);
        if (room) {
          io?.to(room).emit(event, data);
        } else {
          io?.emit(event, data);
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, broadcast: true, room: room || "global" }));
      } catch (e: any) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

let io: Server | null = null;

const init = () => {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/socket/",
    // Only handle WebSocket upgrade requests, let HTTP routes pass through
    serveClient: false,
  });

  io.on("connection", (socket) => {
    console.log(`[ws] Client connected: ${socket.id}`);

    // Clients join rooms based on their role/journal to receive scoped events
    socket.on("subscribe", (rooms: string[]) => {
      for (const room of rooms) {
        socket.join(room);
        console.log(`[ws] ${socket.id} joined room: ${room}`);
      }
    });

    socket.on("unsubscribe", (rooms: string[]) => {
      for (const room of rooms) {
        socket.leave(room);
      }
    });

    socket.on("disconnect", () => {
      console.log(`[ws] Client disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(PORT, () => {
    console.log(`[ws] Socket.io service listening on http://localhost:${PORT}`);
    console.log(`[ws] Health: http://localhost:${PORT}/health`);
    console.log(`[ws] Emit endpoint: POST http://localhost:${PORT}/emit`);
  });
};

init();

export { io };
