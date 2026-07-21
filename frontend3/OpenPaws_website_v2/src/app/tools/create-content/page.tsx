import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canUseTool } from "@/lib/auth";
import { CreateContentClient } from "./create-content-client";

export const metadata: Metadata = {
  title: "Create Content",
  description:
    "Generate on-brand advocacy content — describe what you need and pick from the variants.",
};

export default async function CreateContentPage() {
  // Tool access is per-user, admin-controlled; hiding the nav isn't enough.
  if (!(await canUseTool("create-content"))) redirect("/tools");
  return <CreateContentClient />;
}
