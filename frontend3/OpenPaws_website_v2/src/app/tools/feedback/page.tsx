import type { Metadata } from "next";
import { Heading } from "@/components/ui";
import { FeedbackForm } from "./feedback-form";

export const metadata: Metadata = {
  title: "Feedback",
  description: "Report a bug or request a feature for the Open Paws tools.",
};

export default function FeedbackPage() {
  return (
    <div className="py-4">
      <Heading as="h1" className="text-4xl text-white">
        Feedback &amp; <span className="italic">requests</span>
      </Heading>
      <p className="mt-3 max-w-2xl text-white/60">
        Help us make the tools better. Report a bug, or request a feature you&apos;d
        like to see. Your message is emailed straight to the team.
      </p>

      <div className="mt-8">
        <FeedbackForm />
      </div>
    </div>
  );
}
