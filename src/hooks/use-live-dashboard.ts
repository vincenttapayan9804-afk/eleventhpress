"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { toast } from "sonner";

/**
 * useLiveDashboard — subscribes to the WebSocket mini-service and
 * surfaces live events (new submissions, review completions, workflow
 * transitions) as toasts + a live event feed.
 *
 * Connects via the gateway: io("/?XTransformPort=3003")
 */
export function useLiveDashboard() {
  const user = useApp((s) => s.user);
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    if (!user) return;

    // Dynamically import socket.io-client
    import("socket.io-client").then(({ io }) => {
      const socket = io("/", {
        path: "/socket/",
        query: { XTransformPort: "3003" },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionDelay: 2000,
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        setConnected(true);
        // Subscribe to role-based rooms
        const rooms = ["editors", `user:${user.id}`];
        if (user.role === "EDITOR" || user.role === "ASSOCIATE_EDITOR" || user.role === "SUPER_ADMIN") {
          rooms.push("editorial");
        }
        if (user.role === "REVIEWER") rooms.push("reviewers");
        socket.emit("subscribe", rooms);
      });

      socket.on("disconnect", () => setConnected(false));

      socket.on("submission:new", (data: any) => {
        setLiveEvents((prev) => [{ type: "submission:new", data, at: new Date() }, ...prev].slice(0, 20));
        toast.info("New submission", {
          description: `${data.title} (${data.discipline})`,
        });
      });

      socket.on("workflow:transition", (data: any) => {
        setLiveEvents((prev) => [{ type: "workflow:transition", data, at: new Date() }, ...prev].slice(0, 20));
        if (data.to === "PUBLISHED") {
          toast.success("Article published", {
            description: `${data.title} is now live. DOI: ${data.doi}`,
          });
        }
      });

      socket.on("review:completed", (data: any) => {
        setLiveEvents((prev) => [{ type: "review:completed", data, at: new Date() }, ...prev].slice(0, 20));
        toast.info("Review completed", {
          description: `${data.articleTitle}: ${data.recommendation}`,
        });
      });

      socket.on("doi:deposited", (data: any) => {
        setLiveEvents((prev) => [{ type: "doi:deposited", data, at: new Date() }, ...prev].slice(0, 20));
      });

      socket.on("galley:generated", (data: any) => {
        setLiveEvents((prev) => [{ type: "galley:generated", data, at: new Date() }, ...prev].slice(0, 20));
      });
    }).catch(() => {
      // socket.io-client not available — silently skip
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  return { connected, liveEvents };
}
