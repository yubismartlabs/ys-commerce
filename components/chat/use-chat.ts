"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export type ChatDetail = {
  id: string;
  type: "ORDER" | "INQUIRY";
  subject: string | null;
  blockedById?: string | null;
  other: { id: string; name: string | null; email: string } | null;
  order: { number: string; status: string; total: number } | null;
  product: { title: string; slug: string; image: string } | null;
  store: { name: string; slug: string } | null;
  readStates: Array<{ userId: string; lastReadAt: string }>;
  iAmBuyer: boolean;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  imageUrl: string | null;
  replyToId: string | null;
  flagged: boolean;
  createdAt: string;
  mine?: boolean;
};

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? "Request failed.");
  return json.data;
}

/**
 * Platform-readable conversation: messages travel over TLS and rest sealed
 * at rest (see lib/chat/server-crypto.ts). Trust & safety can read content
 * for moderation and dispute review — stated in the thread UI.
 */
export function useChat(conversationId: string, userId: string) {
  const queryClient = useQueryClient();
  const [peerTyping, setPeerTyping] = useState(false);
  const [live, setLive] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTyping = useRef(0);

  const detailQuery = useQuery({
    queryKey: ["chat-detail", conversationId],
    queryFn: () => api(`/api/v1/chat/conversations/${conversationId}`) as Promise<ChatDetail>,
    retry: false,
  });
  const detail = detailQuery.data ?? null;

  const msgQuery = useQuery({
    queryKey: ["chat-messages", conversationId],
    queryFn: () =>
      api(`/api/v1/chat/conversations/${conversationId}/messages?pageSize=100`) as Promise<ChatMessage[]>,
    // SSE is the primary delivery path, so polling is only a fallback for when
    // the stream can't be established. Previously both ran unconditionally —
    // every open thread fetched the same page three ways (poll + SSE event +
    // focus refetch).
    refetchInterval: live ? false : 15000,
    retry: false,
  });
  const messages: ChatMessage[] = (msgQuery.data ?? []).map((m) => ({ ...m, mine: m.senderId === userId }));

  // SSE live stream; polling on msgQuery covers the case where it can't connect.
  useEffect(() => {
    let es: EventSource | null = null;
    let opened = false;
    try {
      es = new EventSource(`/api/v1/chat/stream?conversationId=${conversationId}`);
      es.onopen = () => {
        opened = true;
        setLive(true);
      };
      es.onerror = () => {
        // Browser retries automatically; fall back to polling meanwhile.
        if (!opened) setLive(false);
      };
      const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
        queryClient.invalidateQueries({ queryKey: ["chat-detail", conversationId] });
      };
      es.addEventListener("message", refresh);
      es.addEventListener("read", () => {
        queryClient.invalidateQueries({ queryKey: ["chat-detail", conversationId] });
      });
      es.addEventListener("notice", refresh);
      es.addEventListener("typing", (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as { userId?: string };
          if (data.userId && data.userId !== userId) {
            setPeerTyping(true);
            if (typingTimer.current) clearTimeout(typingTimer.current);
            typingTimer.current = setTimeout(() => setPeerTyping(false), 4000);
          }
        } catch {
          // ignore malformed
        }
      });
    } catch {
      // EventSource unavailable — `live` is already false, so msgQuery polls.
    }
    return () => {
      es?.close();
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [conversationId, queryClient, userId]);

  // Mark read whenever fresh messages land.
  const latestId = messages.length > 0 ? messages[messages.length - 1].id : null;
  useEffect(() => {
    if (!latestId) return;
    fetch(`/api/v1/chat/conversations/${conversationId}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: latestId }),
    }).catch((e) => console.warn("[chat] mark-read failed:", e));
  }, [latestId, conversationId]);

  const pingTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTyping.current < 3000) return;
    lastTyping.current = now;
    fetch(`/api/v1/chat/conversations/${conversationId}/typing`, { method: "POST" }).catch((e) =>
      console.warn("[chat] typing ping failed:", e)
    );
  }, [conversationId]);

  const send = useCallback(
    async (text: string, image?: { blob: Blob; name: string }, replyToId?: string) => {
      let imageUrl: string | undefined;
      if (image) {
        const form = new FormData();
        form.append("file", image.blob, image.name);
        const up = await fetch("/api/v1/chat/uploads", { method: "POST", body: form });
        const ujson = await up.json().catch(() => null);
        if (!up.ok) throw new Error(ujson?.error?.message ?? "Image upload failed.");
        imageUrl = ujson.data.url as string;
      }
      if (!text.trim() && !imageUrl) throw new Error("Empty message.");

      await api(`/api/v1/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          ...(text.trim() ? { text: text.trim() } : {}),
          ...(replyToId ? { replyToId } : {}),
          ...(imageUrl ? { imageUrl } : {}),
        }),
      });
      queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["chat-detail", conversationId] });
    },
    [conversationId, queryClient]
  );

  const peerReadAt = detail?.readStates.find((r) => r.userId !== userId)?.lastReadAt ?? null;

  return {
    detail,
    detailLoading: detailQuery.isLoading,
    detailError: detailQuery.isError,
    messages,
    messagesLoading: msgQuery.isLoading,
    peerTyping,
    peerReadAt,
    send,
    pingTyping,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["chat-detail", conversationId] });
    },
  };
}
