import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage, pages, type SitePage } from "../site-content";

export function generateStaticParams() {
	return Object.keys(pages).map((slug) => ({ slug }));
}
export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	if (!(slug in pages)) return {};
	const page = pages[slug as SitePage];
	return { title: `${page.title} | Velora`, description: page.lead };
}
export default async function EditorialPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	if (!(slug in pages)) notFound();
	return <ContentPage page={slug as SitePage} />;
}
