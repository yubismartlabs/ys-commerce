"use client";

import { ChatRoomRoute } from "@/components/chat/chat-room";

export default function SellerMessagePage({ params }: { params: Promise<{ id: string }> }) {
  return <ChatRoomRoute params={params} backHref="/selling/messages" />;
}
