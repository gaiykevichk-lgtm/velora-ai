import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";
import "./studio.css";
import "./editorial.css";
import "./reference.css";

export const metadata: Metadata = {
	title: "Velora AI — Automated AI Video & Image Generation",
	description:
		"Automated AI video and image generation by Velora AI. Prepaid EUR tokens, no monthly subscription.",
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en">
			<body className="bg-[#170d06] text-white min-h-screen">{children}</body>
		</html>
	);
}
