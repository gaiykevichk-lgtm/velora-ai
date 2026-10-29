import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { user } from "@/lib/auth";
import { dbAsync } from "@/lib/db";
import { failure, unauthorized } from "@/lib/api";

// Serves a stored generation result (image/video) to its owner only.
export async function GET(req: NextRequest) {
	try {
		const account = await user();
		if (!account) return unauthorized();
		const runId = req.nextUrl.searchParams.get("runId");
		if (!z.string().uuid().safeParse(runId).success)
			return NextResponse.json({ error: "Invalid file." }, { status: 400 });
		const { rows } = await (await dbAsync()).query(
			"SELECT mime,data FROM run_media WHERE run_id=$1 AND user_id=$2",
			[runId, account.id],
		);
		if (!rows[0])
			return NextResponse.json({ error: "File not found." }, { status: 404 });
		const data = Buffer.from(rows[0].data);
		const total = data.length;
		const headers: Record<string, string> = {
			"Content-Type": rows[0].mime,
			"Accept-Ranges": "bytes",
			"Cache-Control": "private, max-age=3600",
		};
		if (req.nextUrl.searchParams.get("download") === "1") {
			const ext = String(rows[0].mime).split("/")[1]?.split("+")[0] || "bin";
			headers["Content-Disposition"] = `attachment; filename="velora-${runId}.${ext}"`;
		}
		const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
		if (range && (range[1] || range[2])) {
			const start = range[1] ? Number(range[1]) : Math.max(0, total - Number(range[2]));
			const end = range[1] && range[2] ? Math.min(Number(range[2]), total - 1) : total - 1;
			if (start > end || start >= total)
				return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
			const part = data.subarray(start, end + 1);
			return new NextResponse(part, {
				status: 206,
				headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${total}`, "Content-Length": String(part.length) },
			});
		}
		return new NextResponse(data, { headers: { ...headers, "Content-Length": String(total) } });
	} catch (e) {
		return failure(e);
	}
}
