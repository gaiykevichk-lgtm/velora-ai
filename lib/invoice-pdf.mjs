import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

// Original approved PDF artwork, with only its variable text removed.
export async function invoicePdf(data) {
	const doc = await PDFDocument.load(
		await readFile(join(process.cwd(), "assets/invoices/template.pdf")),
	);
	doc.registerFontkit(fontkit);
	const font = await doc.embedFont(
		await readFile(join(process.cwd(), "assets/invoices/body.ttf")),
		{ subset: true },
	);
	const page = doc.getPages()[0],
		height = page.getHeight();
	const ink = rgb(0.102, 0.071, 0.051),
		muted = rgb(0.35, 0.29, 0.25);
	function text(value, x, top, size = 10, max = 240, right = false) {
		const s = String(value || "").replace(/[\r\n\t]/g, " ");
		const actual = Math.min(
			size,
			max / Math.max(font.widthOfTextAtSize(s, 1), 1),
		);
		page.drawText(s, {
			x: right ? x - font.widthOfTextAtSize(s, actual) : x,
			y: height - top - actual,
			font,
			size: actual,
			color: ink,
		});
	}
	text(`No. ${data.number}`, 553, 70, 10, 240, true);
	text(`Issued ${data.date}`, 553, 88, 10, 220, true);
	text(
		data.paid ? "PAID" : String(data.status || "Pending").toUpperCase(),
		539,
		114,
		8,
		65,
		true,
	);
	text(data.buyerName || data.email, 58.5, 232, 11, 225);
	text(data.email, 58.5, 251, 9, 225);
	text(data.method, 323.25, 232, 11, 220);
	// References wrap within the approved payment-method panel.
	const ref = String(data.reference || "Awaiting payment");
	const chunks = ref.match(/.{1,45}/g) || [""];
	chunks
		.slice(0, 2)
		.forEach((line, i) =>
			text(`${i ? "" : "Ref: "}${line}`, 323.25, 251 + i * 10, 8, 225),
		);
	text(
		`${Number(data.tokens).toLocaleString("en-US")} tokens${data.paid ? " credited to your balance" : ""}`,
		42,
		360,
		9,
		300,
	);
	text(`€${Number(data.amount).toFixed(2)}`, 553, 342, 12, 180, true);
	text(data.paid ? "Total paid" : "Total due", 390, 419, 10, 100);
	text(
		`€${Number(data.paid ? data.totalPaid : data.amount).toFixed(2)}`,
		553,
		415,
		18,
		155,
		true,
	);
	if (data.paid) {
		const footer = `${Number(data.tokens).toLocaleString("en-US")} tokens were credited to your balance. Thank you!`;
		text(footer, 298 - font.widthOfTextAtSize(footer, 10) / 2, 780, 10, 510);
	}
	doc.setTitle(`Velora AI Invoice ${data.number}`);
	return Buffer.from(await doc.save());
}
