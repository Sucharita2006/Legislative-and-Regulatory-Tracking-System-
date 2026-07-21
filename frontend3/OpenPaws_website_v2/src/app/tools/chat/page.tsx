import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canUseTool } from "@/lib/auth";
import { listSessions, getSession, getMessages } from "@/lib/chat";
import { ChatClient } from "./chat-client";

export const metadata: Metadata = {
  title: "Chat with Database",
  description: "Ask questions and get answers from an AI for animal advocacy.",
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  // Tool access is per-user, admin-controlled; hiding the nav isn't enough.
  if (!(await canUseTool("chat"))) redirect("/tools");

  const { session: requestedId } = await searchParams;

  const sessions = await listSessions();

  // Resolve the active session: requested one (if owned) → otherwise none (new chat).
  let activeId: string | null = null;
  let messages: Awaited<ReturnType<typeof getMessages>> = [];
  if (requestedId) {
    const session = await getSession(requestedId);
    if (session) {
      activeId = session.id;
      messages = await getMessages(session.id);
    }
  }

  return (
    <ChatClient
      sessions={sessions}
      activeSessionId={activeId}
      initialMessages={messages.map((m) => ({ role: m.role, content: m.content }))}
    />
  );
}
