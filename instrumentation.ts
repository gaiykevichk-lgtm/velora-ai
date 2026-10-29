export async function register() {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		const { startVideoSweep } = await import("./instrumentation-node");
		startVideoSweep();
	}
}
