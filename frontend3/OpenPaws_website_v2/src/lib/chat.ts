import { createClient } from "@/lib/supabase/server";

export type ChatSession = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

/** All of the current user's chat sessions, most recently updated first. */
export async function listSessions(): Promise<ChatSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("id, title, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** A single session owned by the current user, or null. */
export async function getSession(id: string): Promise<ChatSession | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chat_sessions")
    .select("id, title, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

/** Messages for a session, oldest first. */
export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, session_id, role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
