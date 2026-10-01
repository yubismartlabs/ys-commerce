"use client";

import { ChatRoomRoute } from "@/components/chat/chat-room";
import { useAccountBase } from "@/lib/account-url";

export default function BuyerMessagePage({ params }: { params: Promise<{ id: string }> }) {
  const base = useAccountBase();
  return <ChatRoomRoute params={params} backHref={`${base}/messages`} />;
}
