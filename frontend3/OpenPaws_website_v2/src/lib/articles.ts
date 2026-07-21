import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";

/**
 * Knowledge Base content engine.
 * Articles are Markdown files in /content/knowledge-base with frontmatter:
 *   ---
 *   title: ...
 *   date: YYYY-MM-DD
 *   excerpt: ...
 *   ---
 * (Phase 3 will add a self-hosted /admin editor on top of this.)
 */

const ARTICLES_DIR = path.join(process.cwd(), "content", "knowledge-base");

/**
 * Frontmatter dates like `date: 2026-04-15` are parsed by YAML into a JS Date,
 * not a string. Coercing with String() would yield "Wed Apr 15 2026 …", which
 * both displays wrong and breaks sorting (it compares weekday names
 * alphabetically). Normalize everything to "YYYY-MM-DD".
 */
function isoDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value ?? "");
}

export type ArticleMeta = {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  category: string;
  author: string;
};

export type Article = ArticleMeta & { contentHtml: string };

function getFiles(): string[] {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  return fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".md"));
}

export function getAllArticles(): ArticleMeta[] {
  return getFiles()
    .map((file) => {
      const slug = file.replace(/\.md$/, "");
      const raw = fs.readFileSync(path.join(ARTICLES_DIR, file), "utf8");
      const { data } = matter(raw);
      return {
        slug,
        title: String(data.title ?? slug),
        date: isoDate(data.date),
        excerpt: String(data.excerpt ?? ""),
        category: String(data.category ?? "Uncategorized"),
        author: String(data.author ?? ""),
      } satisfies ArticleMeta;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getArticleSlugs(): string[] {
  return getFiles().map((f) => f.replace(/\.md$/, ""));
}

export async function getArticle(slug: string): Promise<Article | null> {
  const fullPath = path.join(ARTICLES_DIR, `${slug}.md`);
  if (!fs.existsSync(fullPath)) return null;

  const raw = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(raw);
  const processed = await remark().use(html).process(content);

  return {
    slug,
    title: String(data.title ?? slug),
    date: isoDate(data.date),
    excerpt: String(data.excerpt ?? ""),
    category: String(data.category ?? "Uncategorized"),
    author: String(data.author ?? ""),
    contentHtml: processed.toString(),
  };
}

/** Articles grouped by category, preserving a defined category order. */
export const CATEGORY_ORDER = ["Core Concepts", "Research & Reports"] as const;

export function getArticlesByCategory(): { category: string; articles: ArticleMeta[] }[] {
  const all = getAllArticles();
  const groups = new Map<string, ArticleMeta[]>();
  for (const a of all) {
    if (!groups.has(a.category)) groups.set(a.category, []);
    groups.get(a.category)!.push(a);
  }
  const ordered = [...groups.keys()].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a as (typeof CATEGORY_ORDER)[number]);
    const ib = CATEGORY_ORDER.indexOf(b as (typeof CATEGORY_ORDER)[number]);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return ordered.map((category) => ({
    category,
    articles: groups.get(category)!,
  }));
}

export function formatDate(date: string): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
