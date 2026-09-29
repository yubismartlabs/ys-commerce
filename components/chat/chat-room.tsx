"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft } from "lucide-react";
import { use } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChatThread } from "@/components/chat/chat-thread";

export function ChatRoom({ conversationId, backHref }: { conversationId: string; backHref: string }) {
  const { data: session, status } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (status === "loading") return <Card className="p-6 text-sm text-neutral-500">Loading…</Card>;
  if (!userId) {
    return (
      <Card className="space-y-2 p-6 text-center text-sm text-neutral-500">
        <p>Sign in to view this conversation.</p>
        <Button size="sm" asChild><Link href="/sign-in">Sign in</Link></Button>
      </Card>
    );
  }
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Button variant="ghost" size="sm" asChild className="gap-1">
        <Link href={backHref}><ArrowLeft className="size-4" /> Messages</Link>
      </Button>
      <ChatThread conversationId={conversationId} userId={userId} />
    </div>
  );
}

export function ChatRoomRoute({ params, backHref }: { params: Promise<{ id: string }>; backHref: string }) {
  const { id } = use(params);
  return <ChatRoom conversationId={id} backHref={backHref} />;
}
