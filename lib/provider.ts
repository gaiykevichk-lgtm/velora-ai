import { ConfigurationError } from "./configuration";

export { ConfigurationError } from "./configuration";

function required(...names: string[]) {
	const missing = names.filter((name) => !process.env[name]);
	if (missing.length)
		throw new ConfigurationError(
			`${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} not configured yet. Add provider credentials to enable generation.`,
		);
}

function baseUrl(value: string) {
	return value.replace(/\/$/, "");
}

async function providerFetch(url: string, init: RequestInit, key: string) {
	const response = await fetch(url, {
		...init,
		headers: { Authorization: `Bearer ${key}`, ...(init.headers ?? {}) },
		signal: AbortSignal.timeout(120000),
		cache: "no-store",
	});
	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(
			`Provider request failed (${response.status}). ${text.slice(0, 300)}`.trim(),
		);
	}
	const contentType = response.headers.get("content-type") ?? "";
	if (contentType.includes("application/json")) return response.json();
	return response.text();
}

function messageText(content: unknown): string | null {
	if (typeof content === "string" && content.trim()) return content;
	if (Array.isArray(content)) {
		const text = content
			.filter((part) => part?.type === "text" && typeof part.text === "string")
			.map((part) => part.text as string)
			.join("\n")
			.trim();
		if (text) return text;
	}
	return null;
}

function extractImageUrl(data: any): string | null {
	const candidates: unknown[] = [
		data?.data?.[0]?.url,
		data?.data?.[0]?.b64_json,
		data?.choices?.[0]?.message?.images?.[0]?.image_url?.url,
		data?.choices?.[0]?.message?.images?.[0]?.url,
		data?.choices?.[0]?.message?.image_url?.url,
		data?.choices?.[0]?.message?.content,
		data?.choices?.[0]?.image_url?.url,
		data?.image_url,
		data?.url,
	];
	for (const candidate of candidates) {
		if (typeof candidate !== "string" || !candidate) continue;
		if (candidate.startsWith("https://")) return candidate;
		if (candidate.startsWith("data:image/")) return candidate;
		// OpenAI-style b64_json has no prefix.
		if (/^[A-Za-z0-9+/=]{100,}$/.test(candidate))
			return `data:image/png;base64,${candidate}`;
	}
	return null;
}

export async function generateText(
	messages: { role: "user" | "assistant"; content: string }[],
) {
	required("TEXT_API_BASE_URL", "TEXT_API_KEY", "TEXT_MODEL");
	const data = await providerFetch(
		`${baseUrl(process.env.TEXT_API_BASE_URL!)}/chat/completions`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				model: process.env.TEXT_MODEL,
				messages,
				max_tokens: 1600,
			}),
		},
		process.env.TEXT_API_KEY!,
	);
	const text = messageText(data?.choices?.[0]?.message?.content);
	if (!text)
		throw new Error("The text provider returned an unexpected response.");
	return text;
}

import { type AspectRatio, IMAGE_SIZES } from "./image-format";
export { type AspectRatio, IMAGE_SIZES, imageDimensions, matchesAspect } from "./image-format";

export async function generateImage(
	prompt: string,
	aspect: AspectRatio = "1:1",
	reference?: { mime: string; base64: string },
) {
	required("IMAGE_API_BASE_URL", "IMAGE_API_KEY", "IMAGE_MODEL");
	const base = baseUrl(process.env.IMAGE_API_BASE_URL!);
	const key = process.env.IMAGE_API_KEY!;
	const model = process.env.IMAGE_MODEL!;
	// Editing needs a multimodal model that accepts image input on
	// /chat/completions; pure generation models (qwen-image-3-pro,
	// gpt-image-2.5-sunburst) reject that endpoint.
	const editModel = process.env.IMAGE_EDIT_MODEL?.trim() || model;

	let data: any;
	if (reference) {
		// OpenRouter-compatible chat completions with image input.
		data = await providerFetch(
			`${base}/chat/completions`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					model: editModel,
					messages: [
						{
							role: "user",
							content: [
								{ type: "text", text: prompt },
								{
									type: "image_url",
									image_url: {
										url: `data:${reference.mime};base64,${reference.base64}`,
									},
								},
							],
						},
					],
					modalities: ["image", "text"],
					image_config: { aspect_ratio: aspect, image_size: "1K" },
				}),
			},
			key,
		);
	} else {
		data = await providerFetch(
			`${base}/images/generations`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					model,
					prompt,
					n: 1,
					size: IMAGE_SIZES[aspect],
					aspect_ratio: aspect,
				}),
			},
			key,
		);
	}

	const output = extractImageUrl(data);
	if (!output)
		throw new Error("The image provider returned an unexpected response.");
	return output;
}

export async function submitVideo(
	prompt: string,
	aspectRatio: string,
	duration: number,
	reference?: string,
) {
	required(
		"VIDEO_SUBMIT_URL",
		"VIDEO_STATUS_URL",
		"VIDEO_API_KEY",
		"VIDEO_MODEL",
	);
	const body: Record<string, unknown> = {
		model: process.env.VIDEO_MODEL,
		prompt,
		duration,
		resolution: process.env.VIDEO_RESOLUTION?.trim() || "2K",
		aspect_ratio: aspectRatio,
		generate_audio: true,
	};
	if (reference) {
		body.frame_images = [
			{
				type: "image_url",
				image_url: { url: reference },
				frame_type: "first_frame",
			},
		];
	}
	const data = await providerFetch(
		process.env.VIDEO_SUBMIT_URL!,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		},
		process.env.VIDEO_API_KEY!,
	);
	const id =
		typeof data?.id === "string"
			? data.id
			: typeof data?.job_id === "string"
				? data.job_id
				: null;
	if (!id) throw new Error("The video provider did not return a job ID.");
	const outputUrl =
		typeof data?.output_url === "string"
			? data.output_url
			: typeof data?.video_url === "string"
				? data.video_url
				: null;
	console.info("[video] submitted", { jobId: id, aspectRatio, duration });
	return { id, status: "queued" as const, outputUrl };
}

function extractVideoUrl(data: any, jobId: string): string | null {
	const candidates: unknown[] = [
		data?.output_url,
		data?.video_url,
		data?.url,
		data?.result_url,
		data?.data?.[0]?.url,
		data?.output?.[0]?.url,
		data?.videos?.[0]?.url,
	];
	for (const candidate of candidates) {
		if (typeof candidate === "string" && candidate.startsWith("https://"))
			return candidate;
	}
	// Fall back to our authenticated proxy when the provider only offers /content download.
	return `/api/video-content?jobId=${encodeURIComponent(jobId)}`;
}

export type VideoState = "queued" | "processing" | "completed" | "failed";

export async function videoStatus(id: string) {
	required("VIDEO_STATUS_URL", "VIDEO_API_KEY");
	const template = process.env.VIDEO_STATUS_URL!;
	const url = template.includes("{id}")
		? template.replace("{id}", encodeURIComponent(id))
		: `${baseUrl(template)}/${encodeURIComponent(id)}`;
	const data = await providerFetch(
		url,
		{ method: "GET" },
		process.env.VIDEO_API_KEY!,
	);
	const rawStatus = String(data?.status ?? "queued").toLowerCase();
	let status: VideoState;
	if (["completed", "succeeded", "success", "done", "finished"].includes(rawStatus))
		status = "completed";
	else if (["failed", "error", "cancelled", "canceled", "expired", "rejected"].includes(rawStatus))
		status = "failed";
	else if (["queued", "pending", "submitted", "created", "waiting"].includes(rawStatus))
		status = "queued";
	else status = "processing";
	const reason =
		typeof data?.error === "string"
			? data.error
			: typeof data?.error?.message === "string"
				? data.error.message
				: typeof data?.message === "string"
					? data.message
					: "";
	return {
		status,
		rawStatus,
		reason,
		outputUrl: status === "completed" ? extractVideoUrl(data, id) : null,
	};
}

// Download a finished video so it no longer depends on the provider's retention.
export async function downloadVideo(
	jobId: string,
	outputUrl: string | null,
): Promise<{ mime: string; data: Buffer } | null> {
	required("VIDEO_STATUS_URL", "VIDEO_API_KEY");
	const key = process.env.VIDEO_API_KEY!;
	const template = process.env.VIDEO_STATUS_URL!;
	const base = template.includes("{id}")
		? template.replace("{id}", encodeURIComponent(jobId))
		: `${baseUrl(template)}/${encodeURIComponent(jobId)}`;
	const urls = [
		...(outputUrl?.startsWith("https://") ? [outputUrl] : []),
		`${baseUrl(base)}/content?index=0`,
	];
	for (const url of urls) {
		try {
			const r = await fetch(url, {
				headers: url.startsWith(baseUrl(base)) ? { Authorization: `Bearer ${key}` } : {},
				signal: AbortSignal.timeout(120000),
				cache: "no-store",
			});
			if (!r.ok) continue;
			const data = Buffer.from(await r.arrayBuffer());
			if (data.length > 0 && data.length <= 80_000_000)
				return { mime: r.headers.get("content-type")?.split(";")[0] || "video/mp4", data };
		} catch {
			/* try next source */
		}
	}
	return null;
}

// Fetch an https image or decode a data URI into bytes.
export async function fetchImageBytes(
	result: string,
): Promise<{ mime: string; data: Buffer } | null> {
	const m = /^data:(image\/[a-z+.-]+);base64,([\s\S]+)$/.exec(result);
	if (m) return { mime: m[1], data: Buffer.from(m[2], "base64") };
	if (!result.startsWith("https://")) return null;
	const r = await fetch(result, { signal: AbortSignal.timeout(60000), cache: "no-store" });
	if (!r.ok) return null;
	return { mime: r.headers.get("content-type")?.split(";")[0] || "image/png", data: Buffer.from(await r.arrayBuffer()) };
}
