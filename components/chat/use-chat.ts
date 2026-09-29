"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getStoredPublicKey,
  openConversationKey,
  openFile,
  openText,
  sealConversationKey,
  sealText,
  wrapForRecipient,
} from "@/lib/chat/e2ee";

export type ChatDetail = {
  id: string;
  type: "ORDER" | "INQUIRY";
  subject: string | null;
  blockedById?: string | null;
  other: { id: string; name: string | null; email: string; identityKey: string | null } | null;
  order: { number: string; status: string; total: number } | null;
  product: { title: string; slug: string; image: string } | null;
  store: { name: string; slug: string } | null;
  readStates: Array<{ userId: string; lastReadAt: string }>;
  envelope: { wrappedKey: string; ephemeralPub: string; nonce: string; keyVersion: number } | null;
  iAmBuyer: boolean;
};

export type WireMessage = {
  id: string;
  senderId: string;
  ciphertext: string;
  nonce: string;
  keyVersion: number;
  replyToId: string | null;
  imageUrl: string | null;
  imageNonce: string | null;
  createdAt: string;
};

export type DecryptedMessage = WireMessage & {
  mine: boolean;
  text: string;
  imageObjectUrl?: string;
};

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? "Request failed.");
  return json.data;
}

const keyCache = new Map<string, string>(); // conversationId -> convKey raw b64 (tab lifetime)

/**
 * End-to-end encrypted conversation. Plaintext exists only in this tab:
 * decrypt on receipt, seal before send, re-wrap the peer envelope per
 * message so peer key rotations never strand them.
 */
export function useChat(conversationId: string, userId: string) {
  const queryClient = useQueryClient();
  const [convKey, setConvKey] = useState<string | null>(() => keyCache.get(conversationId) ?? null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [decrypted, setDecrypted] = useState<Map<string, DecryptedMessage>>(new Map());
  const [peerTyping, setPeerTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTyping = useRef(0);
  const imageUrls = useRef<string[]>([]);

  const detailQuery = useQuery({
    queryKey: ["chat-detail", conversationId],
    queryFn: () => api(`/api/v1/chat/conversations/${conversationId}`) as Promise<ChatDetail>,
    retry: false,
  });
  const detail = detailQuery.data ?? null;

  // Resolve (or create) the conversation key.
  useEffect(() => {
    if (!detail || convKey) return;
    let cancelled = false;
    (async () => {
      try {
        if (detail.envelope) {
          try {
            const key = await openConversationKey(userId, detail.envelope);
            if (!cancelled) {
              keyCache.set(conversationId, key);
              setConvKey(key);
            }
            return;
          } catch {
            // Our envelope doesn't open with this device key (rotated?) — re-key below.
          }
        }
        const peerKey = detail.other?.identityKey;
        const myPub = getStoredPublicKey(userId);
        if (!peerKey || !myPub) {
          if (!cancelled) setKeyError("peer-not-ready");
          return;
        }
        const { keyRawB64, envelopes } = await sealConversationKey([myPub, peerKey]);
        const [mine, theirs] = envelopes;
        await api(`/api/v1/chat/conversations/${conversationId}/envelopes`, {
          method: "POST",
          body: JSON.stringify({ userId, ...mine }),
        });
        await api(`/api/v1/chat/conversations/${conversationId}/envelopes`, {
          method: "POST",
          body: JSON.stringify({ userId: detail.other!.id, ...theirs }),
        });
        if (!cancelled) {
          keyCache.set(conversationId, keyRawB64);
          setConvKey(keyRawB64);
        }
      } catch (e) {
        if (!cancelled) setKeyError(e instanceof Error ? e.message : "Key exchange failed.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detail, convKey, conversationId, userId]);

  const msgQuery = useQuery({
    queryKey: ["chat-messages", conversationId],
    queryFn: () =>
      api(`/api/v1/chat/conversations/${conversationId}/messages?pageSize=100`) as Promise<WireMessage[]>,
    enabled: !!convKey,
    refetchInterval: 10000,
    retry: false,
  });
  const wire: WireMessage[] = msgQuery.data ?? [];

  // Decrypt pipeline.
  useEffect(() => {
    if (!convKey || wire.length === 0) return;
    let cancelled = false;
    (async () => {
      const next = new Map<string, DecryptedMessage>();
      for (const m of wire) {
        if (decrypted.has(m.id)) {
          next.set(m.id, decrypted.get(m.id)!);
          continue;
        }
        try {
          const text = await openText(convKey, m.ciphertext, m.nonce);
          let imageObjectUrl: string | undefined;
          if (m.imageUrl && m.imageNonce) {
            const res = await fetch(m.imageUrl);
            const buf = await res.arrayBuffer();
            const plain = await openFile(convKey, buf, m.imageNonce);
            const url = URL.createObjectURL(new Blob([plain], { type: "image/jpeg" }));
            imageUrls.current.push(url);
            imageObjectUrl = url;
          }
          next.set(m.id, { ...m, mine: m.senderId === userId, text, imageObjectUrl });
        } catch {
          next.set(m.id, { ...m, mine: m.senderId === userId, text: "⚠ Couldn't decrypt — key mismatch." });
        }
      }
      if (!cancelled) setDecrypted(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convKey, msgQuery.dataUpdatedAt]);

  useEffect(() => {
    return () => {
      for (const u of imageUrls.current) URL.revokeObjectURL(u);
      imageUrls.current = [];
    };
  }, []);

  // SSE live stream with polling fallback already on msgQuery.
  useEffect(() => {
    if (!convKey) return;
    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/v1/chat/stream?conversationId=${conversationId}`);
      es.addEventListener("message", () => {
        queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
        queryClient.invalidateQueries({ queryKey: ["chat-detail", conversationId] });
      });
      es.addEventListener("read", () => {
        queryClient.invalidateQueries({ queryKey: ["chat-detail", conversationId] });
      });
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
      es.addEventListener("rekey", () => {
        keyCache.delete(conversationId);
        setConvKey(null);
        queryClient.invalidateQueries({ queryKey: ["chat-detail", conversationId] });
      });
    } catch {
      // polling fallback covers it
    }
    return () => {
      es?.close();
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [convKey, conversationId, queryClient, userId]);

  // Mark read whenever fresh messages land.
  const latestId = wire.length > 0 ? wire[wire.length - 1].id : null;
  useEffect(() => {
    if (!convKey || !latestId) return;
    fetch(`/api/v1/chat/conversations/${conversationId}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: latestId }),
    }).catch(() => {});
  }, [convKey, latestId, conversationId]);

  const pingTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTyping.current < 3000) return;
    lastTyping.current = now;
    fetch(`/api/v1/chat/conversations/${conversationId}/typing`, { method: "POST" }).catch(() => {});
  }, [conversationId]);

  const send = useCallback(
    async (text: string, image?: { blob: Blob; name: string }, replyToId?: string) => {
      const key = keyCache.get(conversationId);
      if (!key) throw new Error("Chat key not ready.");
      // Refresh the peer envelope every send — survives peer key rotation.
      const d = queryClient.getQueryData<ChatDetail>(["chat-detail", conversationId]);
      const peer = d?.other;
      if (!peer?.identityKey) throw new Error("Peer hasn't set up chat yet.");
      const fresh = await wrapForRecipient(key, peer.identityKey);
      await api(`/api/v1/chat/conversations/${conversationId}/envelopes`, {
        method: "POST",
        body: JSON.stringify({ userId: peer.id, ...fresh }),
      });

      let imageUrl: string | undefined;
      let imageNonce: string | undefined;
      if (image) {
        const buf = await image.blob.arrayBuffer();
        const { sealFile } = await import("@/lib/chat/e2ee");
        const sealed = await sealFile(key, buf);
        const form = new FormData();
        form.append("file", new Blob([sealed.data], { type: "application/octet-stream" }), `${image.name}.enc`);
        const up = await fetch("/api/v1/chat/uploads", { method: "POST", body: form });
        const ujson = await up.json().catch(() => null);
        if (!up.ok) throw new Error(ujson?.error?.message ?? "Image upload failed.");
        imageUrl = ujson.data.url as string;
        imageNonce = sealed.nonce;
      }
      if (!text.trim() && !imageUrl) throw new Error("Empty message.");

      const sealed = await sealText(key, text.trim() || "(image)");
      await api(`/api/v1/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          ciphertext: sealed.ciphertext,
          nonce: sealed.nonce,
          ...(replyToId ? { replyToId } : {}),
          ...(imageUrl ? { imageUrl, imageNonce } : {}),
        }),
      });
      queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["chat-detail", conversationId] });
    },
    [conversationId, queryClient]
  );

  const messages = [...decrypted.values()].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  const peerReadAt = detail?.readStates.find((r) => r.userId !== userId)?.lastReadAt ?? null;

  return {
    detail,
    detailLoading: detailQuery.isLoading,
    detailError: detailQuery.isError,
    convKey,
    keyError,
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
