// Server-side video job tracking. Runs from the background sweep started in
// instrumentation.ts and lazily whenever a client reads history, so a job is
// finished and its tokens settled even when no browser tab is open.
import { dbAsync } from "./db";
import { randomUUID } from "node:crypto";
import { captureReservation, grantTokens, releaseReservation } from "./tokens";
import { downloadVideo, videoStatus } from "./provider";

export const VIDEO_TIMEOUT_MINUTES = Number(
	process.env.VIDEO_TIMEOUT_MINUTES ?? "30",
);
const SUBMIT_GRACE_MINUTES = 3;

type RunRow = {
	id: string;
	user_id: string;
	provider_job_id: string | null;
	status: string;
	created_at: string | Date;
};

export async function failRun(runId: string, publicError: string, detail: string) {
	const pool = await dbAsync();
	console.error("[video] run failed", { runId, detail });
	await pool.query(
		"UPDATE runs SET status='failed', error=$2, updated_at=now() WHERE id=$1 AND status IN ('pending','queued','processing')",
		[runId, publicError],
	);
	const released = await releaseReservation(pool, runId);
	if (!released) await refundLegacyCharge(runId);
}

// Runs created before reservations existed were charged up front. When such a
// run fails, refund it exactly once (a settled reservation row is the marker).
async function refundLegacyCharge(runId: string) {
	const pool = await dbAsync();
	const run = await pool.query(
		"SELECT user_id,tokens_spent FROM runs WHERE id=$1",
		[runId],
	);
	const row = run.rows[0];
	if (!row || Number(row.tokens_spent) <= 0) return;
	const marker = await pool.query(
		"INSERT INTO token_reservations (id,run_id,user_id,amount,lots,state,settled_at) VALUES ($1,$2,$3,$4,'[]'::jsonb,'released',now()) ON CONFLICT (run_id) DO NOTHING RETURNING id",
		[randomUUID(), runId, row.user_id, Number(row.tokens_spent)],
	);
	if (!marker.rowCount) return;
	const charged = await pool.query(
		"SELECT 1 FROM token_transactions WHERE user_id=$1 AND amount=$2 AND reason LIKE 'Generation: video%' LIMIT 1",
		[row.user_id, -Number(row.tokens_spent)],
	);
	if (!charged.rowCount) return;
	await grantTokens(pool, row.user_id, Number(row.tokens_spent), "Refund: failed video");
	await pool.query(
		"INSERT INTO token_transactions (id,user_id,amount,reason) VALUES ($1,$2,$3,$4)",
		[randomUUID(), row.user_id, Number(row.tokens_spent), `Refund: failed video (+${row.tokens_spent} tokens)`],
	);
}

export async function completeRun(runId: string, userId: string, result: string, mime: string, data: Buffer) {
	const pool = await dbAsync();
	await pool.query(
		"INSERT INTO run_media (run_id,user_id,mime,data) VALUES ($1,$2,$3,$4) ON CONFLICT (run_id) DO NOTHING",
		[runId, userId, mime, data],
	);
	const upd = await pool.query(
		"UPDATE runs SET status='completed', result=$2, error=NULL, updated_at=now() WHERE id=$1 AND status IN ('pending','queued','processing')",
		[runId, result],
	);
	if (upd.rowCount) await captureReservation(pool, runId, "Generation: video");
}

export async function reconcileRun(row: RunRow) {
	const pool = await dbAsync();
	const ageMin = (Date.now() - new Date(row.created_at).getTime()) / 60000;
	if (!row.provider_job_id) {
		if (ageMin > SUBMIT_GRACE_MINUTES)
			await failRun(row.id, "The video could not be started. Your tokens were returned.", "no provider job id");
		return;
	}
	try {
		const latest = await videoStatus(row.provider_job_id);
		if (latest.status === "completed") {
			const file = await downloadVideo(row.provider_job_id, latest.outputUrl);
			if (!file) {
				if (ageMin > VIDEO_TIMEOUT_MINUTES)
					await failRun(row.id, "The finished video could not be retrieved. Your tokens were returned.", `download failed job=${row.provider_job_id}`);
				return;
			}
			await completeRun(row.id, row.user_id, `/api/media?runId=${row.id}`, file.mime, file.data);
			console.info("[video] completed", { runId: row.id, jobId: row.provider_job_id, bytes: file.data.length });
			return;
		}
		if (latest.status === "failed") {
			await failRun(
				row.id,
				"The video provider could not complete this video. Your tokens were returned.",
				`provider job=${row.provider_job_id} status=${latest.rawStatus} reason=${latest.reason}`,
			);
			return;
		}
		await pool.query(
			"UPDATE runs SET status=$2, provider_status=$3, updated_at=now() WHERE id=$1 AND status IN ('pending','queued','processing')",
			[row.id, latest.status, latest.rawStatus],
		);
	} catch (e) {
		console.error("[video] status check failed", { runId: row.id, jobId: row.provider_job_id, error: (e as Error).message });
	}
	if (ageMin > VIDEO_TIMEOUT_MINUTES)
		await failRun(
			row.id,
			`The video was not ready after ${VIDEO_TIMEOUT_MINUTES} minutes. Your tokens were returned.`,
			`timeout job=${row.provider_job_id}`,
		);
}

let sweeping = false;
// Reconcile every unfinished video (optionally for one user only).
export async function sweepVideos(userId?: string) {
	if (sweeping && !userId) return 0;
	if (!userId) sweeping = true;
	try {
		const pool = await dbAsync();
		const { rows } = await pool.query(
			userId
				? "SELECT id,user_id,provider_job_id,status,created_at FROM runs WHERE mode='video' AND status IN ('pending','queued','processing') AND user_id=$1 LIMIT 20"
				: "SELECT id,user_id,provider_job_id,status,created_at FROM runs WHERE mode='video' AND status IN ('pending','queued','processing') LIMIT 50",
			userId ? [userId] : [],
		);
		for (const row of rows as RunRow[]) await reconcileRun(row);
		return rows.length;
	} finally {
		if (!userId) sweeping = false;
	}
}
