/** Registry of advocate tools shown on the /tools hub. */

export type Tool = {
  slug: string;
  name: string;
  icon: string;
  description: string;
  href: string;
  status: "live" | "coming-soon";
  /** When true, `href` is an external site — opened in a new tab. */
  external?: boolean;
};

export const tools: Tool[] = [
  {
    slug: "chat",
    name: "Chat with Database",
    icon: "💬",
    description:
      "Ask questions and get answers from an AI fine-tuned for animal advocacy. Your conversations are saved so you can revisit them.",
    href: "/tools/chat",
    status: "live",
  },
  {
    slug: "legal-research",
    name: "Legal Research",
    icon: "⚖️",
    description:
      "Research animal-related law and policy. The assistant searches legal databases and streams back its findings.",
    href: "/tools/legal-research",
    status: "live",
  },
  {
    slug: "key-issue-tracker",
    name: "Key Issue Tracker",
    icon: "🔬",
    description:
      "Track key animal advocacy issues. The assistant searches across sources and streams back its findings.",
    href: "/tools/key-issue-tracker",
    status: "live",
  },
  {
    slug: "legislative-tracker",
    name: "Legislative Tracker",
    icon: "📜",
    description:
      "Track animal welfare and protection legislation. The assistant searches legislative databases and streams back its findings.",
    href: "/tools/legislative-tracker",
    status: "live",
  },
  {
    slug: "org-research",
    name: "Organization Research",
    icon: "🏢",
    description:
      "Gather open-source intelligence on a company — structure, key people, recent news, and other public data.",
    href: "/tools/org-research",
    status: "live",
  },
  {
    slug: "personal-research",
    name: "Personal Research",
    icon: "👤",
    description:
      "Build a research profile of a person from their LinkedIn and company — background, role, and public information.",
    href: "/tools/personal-research",
    status: "live",
  },
  {
    slug: "where-they-stand",
    name: "Where They Stand",
    icon: "🗳️",
    description:
      "Look up where politicians and public figures stand on animal issues, via Where They Stand.",
    href: "https://wheretheystand.org/",
    status: "live",
    external: true,
  },
];
