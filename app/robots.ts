import type { MetadataRoute } from "next";

const base = (process.env.APP_BASE_URL || "https://veloraai.pro").replace(/\/$/, "");
export default function robots(): MetadataRoute.Robots {
	return {
		rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/studio", "/reset-password"] },
		sitemap: `${base}/sitemap.xml`,
	};
}
