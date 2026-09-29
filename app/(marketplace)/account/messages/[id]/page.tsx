"use client";

import { ChatRoomRoute } from "@/components/chat/chat-room";

export default function BuyerMessagePage({ params }: { params: Promise<{ id: string }> }) {
  return <ChatRoomRoute params={params} backHref="/account/messages" />;
}
