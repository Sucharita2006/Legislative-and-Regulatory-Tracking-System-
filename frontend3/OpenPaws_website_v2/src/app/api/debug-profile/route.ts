import { NextResponse } from "next/server";
import { getAccessProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  const { data: rawProfile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const profile = await getAccessProfile();
  return NextResponse.json({
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
    userError: userError?.message ?? null,
    rawProfile,
    profileError: profileError?.message ?? null,
    profile,
  });
}
