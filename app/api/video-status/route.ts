import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { user } from "@/lib/auth";
import { dbAsync } from "@/lib/db";
import { failure, unauthorized } from "@/lib/api";
import { sweepVideos } from "@/lib/video-jobs";
import { reservedTokens, syncTokenBalance } from "@/lib/tokens";

// Read-only for the client: the server finishes jobs itself. This endpoint
// triggers an immediate check and reports the stored state.
export async function GET(req: NextRequest) {
	try {
		const account = await user();
		if (!account) return unauthorized();
		const id = req.nextUrl.searchParams.get("id");
		if (!z.string().uuid().safeParse(id).success)
			return NextResponse.json({ error: "Invalid run." }, { status: 400 });
		const pool = await dbAsync();
		await sweepVideos(account.id).catch(() => {});
		const { rows } = await pool.query(
			"SELECT status,result,error FROM runs WHERE id=$1 AND user_id=$2 AND mode='video'",
			[id, account.id],
		);
		if (!rows[0])
			return NextResponse.json({ error: "Run not found." }, { status: 404 });
		const balance = await syncTokenBalance(pool, account.id);
		return NextResponse.json({
			status: rows[0].status,
			result: rows[0].result,
			error: rows[0].error,
			tokens: balance.tokens,
			reserved: await reservedTokens(pool, account.id),
		});
	} catch (e) {
		return failure(e);
	}
}
