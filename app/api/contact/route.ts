import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { failure } from "@/lib/api";
import { COMPANY } from "@/lib/company";
import { mailConfigured, sendPlainMail } from "@/lib/verify-email";

export const dynamic = "force-dynamic";
const schema = z.object({
	name: z.string().trim().min(1).max(120),
	email: z.string().trim().email().max(254),
	message: z.string().trim().min(5).max(5000),
	website: z.string().max(0).optional(), // honeypot
});
const hits = new Map<string, number[]>();

export async function POST(req: NextRequest) {
	try {
		const parsed = schema.safeParse(await req.json().catch(() => null));
		if (!parsed.success)
			return NextResponse.json({ error: "Please fill in your name, a valid email and a message." }, { status: 400 });
		const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
		const now = Date.now();
		const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
		if (recent.length >= 5)
			return NextResponse.json({ error: "Too many messages. Please try again later." }, { status: 429 });
		hits.set(ip, [...recent, now]);
		if (!mailConfigured()) {
			console.error("[contact] mail transport not configured; message not delivered");
			return NextResponse.json({ error: "Your message could not be sent right now. Please email us directly." }, { status: 503 });
		}
		const { name, email, message } = parsed.data;
		try {
			await sendPlainMail(
				COMPANY.email,
				`Velora AI enquiry from ${name.replace(/[\r\n]+/g, " ")}`,
				`From: ${name} <${email}>\n\n${message}`,
			);
		} catch (e) {
			console.error("[contact] send failed:", (e as Error).message);
			return NextResponse.json({ error: "Your message could not be sent right now. Please try again later." }, { status: 502 });
		}
		return NextResponse.json({ ok: true });
	} catch (e) {
		return failure(e);
	}
}
