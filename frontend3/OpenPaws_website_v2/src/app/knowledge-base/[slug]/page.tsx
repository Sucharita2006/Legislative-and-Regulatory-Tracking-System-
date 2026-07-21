import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, Heading, SectionLabel } from "@/components/ui";
import { getArticle, getArticleSlugs, formatDate } from "@/lib/articles";

type Params = { slug: string };

export function generateStaticParams() {
  return getArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Article not found" };
  return {
    title: article.title,
    description: article.excerpt,
    openGraph: { title: article.title, description: article.excerpt },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  return (
    <Container className="py-24">
      <article className="mx-auto max-w-2xl">
        <Link
          href="/knowledge-base"
          className="font-mono text-xs uppercase tracking-[0.15em] text-grey transition-colors hover:text-white"
        >
          ← Knowledge Base
        </Link>

        <div className="mt-8">
          <SectionLabel>{article.category}</SectionLabel>
          <Heading as="h1" className="mt-4 text-4xl text-white sm:text-5xl">
            {article.title}
          </Heading>
          {article.excerpt && (
            <p className="mt-5 text-lg leading-relaxed text-white/60">
              {article.excerpt}
            </p>
          )}
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.15em] text-grey">
            {[article.author, formatDate(article.date)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <hr className="my-10 border-white/10" />

        <div
          className="prose-paws"
          dangerouslySetInnerHTML={{ __html: article.contentHtml }}
        />
      </article>
    </Container>
  );
}
