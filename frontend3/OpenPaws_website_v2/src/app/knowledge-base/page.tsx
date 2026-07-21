import type { Metadata } from "next";
import Link from "next/link";
import { Container, Heading, SectionLabel } from "@/components/ui";
import { getArticlesByCategory, formatDate, type ArticleMeta } from "@/lib/articles";

export const metadata: Metadata = {
  title: "Knowledge Base",
  description:
    "Guides, deep dives, and research on AI for the animal advocacy movement.",
};

export default function KnowledgeBasePage() {
  const groups = getArticlesByCategory();

  return (
    <Container className="py-24">
      <div className="max-w-3xl">
        <SectionLabel index="01">Knowledge Base</SectionLabel>
        <Heading as="h1" className="mt-6 text-5xl text-white sm:text-6xl">
          Guides &amp; <span className="italic">research</span>
        </Heading>
        <p className="mt-8 text-lg leading-relaxed text-white/70">
          Practical guides, how-tos, and original research from our work at the
          intersection of AI and animal advocacy.
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="mt-14 text-white/50">No articles yet — check back soon.</p>
      ) : (
        groups.map(({ category, articles }, i) => (
          <section key={category} className="mt-16">
            <SectionLabel index={String(i + 2).padStart(2, "0")}>
              {category}
            </SectionLabel>
            <div className="mt-6 border-t border-white/10">
              {articles.map((article) => (
                <ArticleRow key={article.slug} article={article} />
              ))}
            </div>
          </section>
        ))
      )}
    </Container>
  );
}

function ArticleRow({ article }: { article: ArticleMeta }) {
  return (
    <Link
      href={`/knowledge-base/${article.slug}`}
      className="group flex flex-col gap-3 border-b border-white/10 py-8 transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-baseline sm:gap-8"
    >
      <time className="shrink-0 font-mono text-xs uppercase tracking-[0.15em] text-grey sm:w-40">
        {formatDate(article.date)}
      </time>
      <div>
        <Heading className="text-2xl text-white transition-colors group-hover:text-teal">
          {article.title}
        </Heading>
        {article.excerpt && (
          <p className="mt-2 max-w-2xl text-white/60">{article.excerpt}</p>
        )}
      </div>
    </Link>
  );
}
