import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";
import "./studio.css";
import "./editorial.css";

export const metadata: Metadata = {
	title: "Velora — AI Video & Image Generation Platform with Human Refinement",
	description:
		"Transform your ideas into high-impact videos and visuals with AI generation and human-assisted refinement. Pay only for what you create with transparent token-based pricing.",
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
