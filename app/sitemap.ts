import type { MetadataRoute } from "next";
import { pages } from "./site-content";

const base = (process.env.APP_BASE_URL || "https://veloraai.pro").replace(/\/$/, "");
export default function sitemap(): MetadataRoute.Sitemap {
	return ["", "/examples", ...Object.keys(pages).map((slug) => `/${slug}`)].map((path) => ({
		url: `${base}${path}`,
	}));
}
