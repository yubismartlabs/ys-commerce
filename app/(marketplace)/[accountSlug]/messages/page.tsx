"use client";

import { ChatInbox } from "@/components/chat/chat-inbox";
import { useAccountBase } from "@/lib/account-url";

export default function BuyerMessagesPage() {
  const base = useAccountBase();
  return <ChatInbox basePath={`${base}/messages`} />;
}
