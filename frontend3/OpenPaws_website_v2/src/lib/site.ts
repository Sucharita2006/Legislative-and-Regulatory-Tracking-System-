/** Central site configuration — nav links, external URLs, etc. */

export const siteConfig = {
  name: "Open Paws",
  tagline: "Building AI for Animal Advocates",
  description:
    "Open source tools, hackathons, and research to power the animal advocacy movement.",
  // Internal donate page hosting the Donorbox embed.
  donateUrl: "/donate",
};

export const navLinks = [
  { label: "Tools for Advocates", href: "/tools-for-advocates" },
  { label: "Tools for Developers", href: "/tools-for-developers" },
  { label: "Knowledge Base", href: "/knowledge-base" },
] as const;

/**
 * The open-source ecosystem shown on the Tools for Developers page.
 * Content & links mirror the original openpaws.ai/tools-for-developers.
 */
export const developerResources = [
  {
    icon: "🔄",
    title: "n8n Workflow Automations",
    description:
      "We provide a full suite of n8n automation workflows that streamline advocacy operations.",
    href: "https://n8n.io/creators/openpaws/",
    cta: "Browse workflows",
  },
  {
    icon: "💬",
    title: "Specialized Generative AI",
    description:
      "Open Paws has developed domain-specific language models fine-tuned for animal advocacy, reasoning, and ethical alignment.",
    href: "https://github.com/Open-Paws/Open-Paws-Documentation/tree/main/Generation",
    cta: "View documentation",
  },
  {
    icon: "📚",
    title: "Knowledge Infrastructure",
    description:
      "We've built a powerful vector-graph database designed to connect and surface knowledge across the animal advocacy space.",
    href: "https://github.com/Open-Paws/Open-Paws-Documentation/tree/main/Knowledge",
    cta: "View documentation",
  },
  {
    icon: "📈",
    title: "Prediction Models",
    description:
      "Our powerful text regression models predict advocacy performance, preference alignment, and message impact using real-world data.",
    href: "https://github.com/Open-Paws/Open-Paws-Documentation/tree/main/Predictions",
    cta: "View documentation",
  },
  {
    icon: "📦",
    title: "Datasets",
    description:
      "We maintain a growing collection of HuggingFace-hosted datasets to power model training, fine-tuning, and evaluation.",
    href: "https://huggingface.co/open-paws",
    cta: "View on HuggingFace",
  },
] as const;

/** "Build with us" Google Form, embedded on the developers page. */
export const developerSignupUrl =
  "https://docs.google.com/forms/d/e/1FAIpQLSeF6u1n-2lZNMxFwiOb9RRq_O-VPq8EuyBrN2TwsEPkdkl8IA/viewform";
