export type AspectRatio = "16:9" | "9:16" | "1:1";

// Pixel sizes sent to OpenAI-compatible /images/generations.
export const IMAGE_SIZES: Record<AspectRatio, string> = {
	"1:1": "1024x1024",
	"16:9": "1792x1024",
	"9:16": "1024x1792",
};

function ratioOf(aspect: AspectRatio) {
	const [w, h] = aspect.split(":").map(Number);
	return w / h;
}

// Read width/height from PNG, JPEG or WebP bytes (null when unknown).
export function imageDimensions(
	buf: Buffer,
): { width: number; height: number } | null {
	if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47)
		return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
	if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
		let i = 2;
		while (i + 9 < buf.length) {
			if (buf[i] !== 0xff) {
				i++;
				continue;
			}
			const marker = buf[i + 1];
			if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
				return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
			i += 2 + buf.readUInt16BE(i + 2);
		}
		return null;
	}
	if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
		const kind = buf.toString("ascii", 12, 16);
		if (kind === "VP8X")
			return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
		if (kind === "VP8 ")
			return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
		if (kind === "VP8L") {
			const b = buf.readUInt32LE(21);
			return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
		}
	}
	return null;
}

// Does the delivered image match the requested format? Unknown size passes.
export function matchesAspect(buf: Buffer, aspect: AspectRatio) {
	const dim = imageDimensions(buf);
	if (!dim || !dim.width || !dim.height) return true;
	return Math.abs(dim.width / dim.height / ratioOf(aspect) - 1) <= 0.06;
}

