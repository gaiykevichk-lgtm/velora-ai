// Background tracker for video jobs: runs inside the server process so jobs
// are finished and tokens settled whether or not anybody has the site open.
import { sweepVideos } from "./lib/video-jobs";

export function startVideoSweep() {
	if (!process.env.DATABASE_URL && process.env.VELORA_TEST_DB !== "memory") return;
	const g = globalThis as { __veloraSweep?: NodeJS.Timeout };
	if (g.__veloraSweep) return;
	g.__veloraSweep = setInterval(() => {
		sweepVideos().catch((e) =>
			console.error("[video] sweep failed", (e as Error).message),
		);
	}, 20000);
	g.__veloraSweep.unref?.();
}
