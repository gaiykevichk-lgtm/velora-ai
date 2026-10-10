import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { user } from "@/lib/auth";
import { dbAsync } from "@/lib/db";
import { failure, unauthorized } from "@/lib/api";

export async function GET(req: NextRequest) {
	try {
		const account = await user();
		if (!account) return unauthorized();
		const jobId = req.nextUrl.searchParams.get("jobId");
		if (!jobId || !z.string().min(1).max(200).safeParse(jobId).success)
			return NextResponse.json(
				{ error: "Invalid video job." },
				{ status: 400 },
			);
		const { rows } = await (await dbAsync()).query<{ provider_job_id: string }>(
			"SELECT provider_job_id FROM runs WHERE provider_job_id=$1 AND user_id=$2 AND mode='video' LIMIT 1",
			[jobId, account.id],
		);
		if (!rows[0])
			return NextResponse.json({ error: "Video not found." }, { status: 404 });
		const base = (process.env.VIDEO_STATUS_URL || "").replace(
			"{id}",
			encodeURIComponent(jobId),
		);
		const key = process.env.VIDEO_API_KEY;
		if (!base || !key)
			return NextResponse.json(
				{ error: "Video provider is not configured." },
				{ status: 503 },
			);
		const contentUrl = base.endsWith("/")
			? `${base}content?index=0`
			: `${base}/content?index=0`;
		const upstream = await fetch(contentUrl, {
			headers: { Authorization: `Bearer ${key}` },
			signal: AbortSignal.timeout(120000),
			cache: "no-store",
		});
		if (!upstream.ok)
			return NextResponse.json(
				{ error: `Video download failed (${upstream.status}).` },
				{ status: 502 },
			);
		const buffer = Buffer.from(await upstream.arrayBuffer());
		return new NextResponse(buffer, {
			headers: {
				"Content-Type": upstream.headers.get("content-type") || "video/mp4",
				"Content-Length": String(buffer.length),
				"Cache-Control": "private, max-age=3600",
			},
		});
	} catch (e) {
		return failure(e);
	}
}
