"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
	ArrowLeft,
	Check,
	Coins,
	Download,
	Loader2,
	RefreshCw,
	RotateCcw,
	Search,
	ShieldCheck,
	Undo2,
	X,
} from "lucide-react";

type OrderRow = {
	kind: "bank" | "card";
	id: string;
	number: string;
	date: string;
	customer: string;
	email: string;
	method: string;
	orderedEur: number;
	receivedEur: number;
	tokensOrdered: number;
	tokensCredited: number;
	payer: string;
	status: string;
};

type BankDetail = {
	order: any;
	payments: any[];
	evidence: any[];
	mail: any;
	docs: any[];
	history: any[];
	refunds: any[];
};

const STATUS: Record<string, { key: string; label: string }> = {
	awaiting_payment: { key: "await", label: "Awaiting Payment" },
	confirmed: { key: "await", label: "Awaiting Payment" },
	reported: { key: "review", label: "Under Review" },
	partial: { key: "needs", label: "Needs Review" },
	review: { key: "needs", label: "Needs Review" },
	credited: { key: "paid", label: "Paid" },
	refunded: { key: "refund", label: "Refunded" },
	cancelled: { key: "cancel", label: "Cancelled" },
	creating: { key: "await", label: "Awaiting Payment" },
	pending: { key: "await", label: "Awaiting Payment" },
	processing: { key: "review", label: "Under Review" },
	expired: { key: "cancel", label: "Expired" },
};

const HISTORY_LABEL: Record<string, string> = {
	"order.confirmed": "Order created",
	"payment.reported": "Payment reported by customer",
	"payment.recorded": "Payment confirmed",
	"order.credited": "Tokens credited",
	"order.review": "Left on manual review",
	"order.reported": "Payment reported by customer",
	"order.cancelled": "Cancelled",
	"order.refunded": "Refund recorded",
	"account.granted": "Manual token grant",
	"contract.attached": "Contract attached",
	"dossier.downloaded": "Dossier downloaded",
};

const DOC_LABEL: Record<string, string> = {
	confirmation: "Order Confirmation",
	invoice: "Invoice",
	receipt: "Payment Confirmation",
};

const eur = (n: number) => `€${Number(n).toFixed(2)}`;
const dt = (s: string) =>
	s ? new Date(s).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—";

async function req<T>(url: string, init?: RequestInit): Promise<T> {
	const r = await fetch(url, {
		...init,
		headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
	});
	const d = await r.json().catch(() => ({}));
	if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`);
	return d as T;
}

export function AdminApp({ email }: { email: string }) {
	const [orders, setOrders] = useState<OrderRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [query, setQuery] = useState("");
	const [method, setMethod] = useState("");
	const [chip, setChip] = useState("");
	const [selected, setSelected] = useState<OrderRow | null>(null);
	const [detail, setDetail] = useState<BankDetail | null>(null);
	const [detailLoading, setDetailLoading] = useState(false);
	const [notice, setNotice] = useState("");

	const load = useCallback(async () => {
		try {
			const d = await req<{ orders: OrderRow[] }>("/api/admin/orders");
			setOrders(d.orders);
			setError("");
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const open = useCallback(async (o: OrderRow) => {
		setSelected(o);
		setDetail(null);
		setNotice("");
		if (o.kind !== "bank") return;
		setDetailLoading(true);
		try {
			const d = await req<BankDetail>(`/api/bank-transfer/orders?id=${o.id}`);
			setDetail(d);
		} catch (e) {
			setNotice((e as Error).message);
		} finally {
			setDetailLoading(false);
		}
	}, []);

	const refreshDetail = useCallback(async () => {
		if (selected?.kind === "bank") {
			setDetail(await req<BankDetail>(`/api/bank-transfer/orders?id=${selected.id}`));
		}
		await load();
	}, [selected, load]);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return orders.filter((o) => {
			const s = STATUS[o.status]?.key ?? o.status;
			if (chip && s !== chip) return false;
			if (method && o.method !== method) return false;
			if (
				q &&
				!`${o.number} ${o.email} ${o.customer}`.toLowerCase().includes(q)
			)
				return false;
			return true;
		});
	}, [orders, query, method, chip]);

	const counts = useMemo(() => {
		const c: Record<string, number> = {};
		for (const o of orders) {
			const k = STATUS[o.status]?.key ?? o.status;
			c[k] = (c[k] ?? 0) + 1;
		}
		return c;
	}, [orders]);

	return (
		<div className="min-h-screen bg-[#0d0803] text-[#d9cfba]">
			<div className="mx-auto max-w-[1120px] px-4 py-8 sm:px-8">
				<header className="mb-6 flex flex-wrap items-end justify-between gap-4">
					<div>
						<h1 className="text-2xl font-bold text-[#f7efe0]">
							Admin
						</h1>
						<p className="text-sm text-[#9a8c74]">
							Orders — card payments and bank transfers
						</p>
					</div>
					<Link
						href="/studio"
						className="rounded-lg border border-[#3a2a1a] bg-[#1d1208] px-3 py-2 text-xs font-semibold text-[#d9cfba] hover:text-white"
					>
						← Back to Studio
					</Link>
				</header>

				{error && (
					<div className="mb-4 rounded-lg border border-[#e93e3a] bg-[#2b0f0b] px-3 py-2 text-xs text-[#ff9988]">
						{error}
					</div>
				)}

				{!selected ? (
					<>
						<div className="mb-4 rounded-xl border border-[#2a1c10] bg-[#160d06] p-4">
							<div className="flex flex-wrap gap-2">
								<label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-[#3a2a1a] bg-[#1d1208] px-3 py-2">
									<Search size={14} className="text-[#9a8c74]" />
									<input
										value={query}
										onChange={(e) => setQuery(e.target.value)}
										placeholder="Search order number or customer email…"
										className="w-full min-w-0 bg-transparent text-sm text-[#f7efe0] outline-none placeholder:text-[#9a8c74]"
									/>
								</label>
								<select
									value={method}
									onChange={(e) => setMethod(e.target.value)}
									className="rounded-lg border border-[#3a2a1a] bg-[#1d1208] px-3 py-2 text-sm text-[#f7efe0] outline-none"
								>
									<option value="">All methods</option>
									<option>Card</option>
									<option>Bank Transfer</option>
								</select>
							</div>
							<div className="mt-3 flex flex-wrap gap-1.5">
								{[
									["", "All"],
									["await", "Awaiting Payment"],
									["review", "Under Review"],
									["needs", "Needs Review"],
									["paid", "Paid"],
									["refund", "Refunded"],
								].map(([k, label]) => (
									<button
										key={k}
										type="button"
										onClick={() => setChip(k)}
										className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
											chip === k
												? "border-[#f54900] bg-[#f54900] text-white"
												: "border-[#3a2a1a] text-[#9a8c74] hover:text-white"
										}`}
									>
										{label}
										<span className="ml-1.5 font-mono text-[10px] opacity-75">
											{k ? counts[k] ?? 0 : orders.length}
										</span>
									</button>
								))}
							</div>
						</div>

						<div className="overflow-x-auto rounded-xl border border-[#2a1c10] bg-[#160d06]">
							<table className="w-full min-w-[940px] border-collapse">
								<thead>
									<tr className="bg-[#1d1208] text-left text-[10px] font-bold uppercase tracking-wider text-[#9a8c74]">
										{[
											"Order Number",
											"Date",
											"Customer / Email",
											"Method",
											"Ordered",
											"Received",
											"Tokens Credited",
											"Status",
											"",
										].map((h, i) => (
											<th
												key={h}
												className={`whitespace-nowrap px-4 py-3 ${i >= 4 && i <= 6 ? "text-right" : ""}`}
											>
												{h}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{loading && (
										<tr>
											<td colSpan={9} className="px-4 py-10 text-center text-sm">
												<Loader2 size={16} className="mr-2 inline animate-spin" />
												Loading orders…
											</td>
										</tr>
									)}
									{!loading && filtered.length === 0 && (
										<tr>
											<td colSpan={9} className="px-4 py-10 text-center text-sm text-[#9a8c74]">
												No orders match the filters.
											</td>
										</tr>
									)}
									{filtered.map((o) => {
										const st = STATUS[o.status] ?? {
											key: o.status,
											label: o.status,
										};
										const pill = {
											paid: "bg-[#0f2e1a] text-[#3ee06a]",
											review: "bg-[#33220f] text-[#f5a623]",
											needs: "bg-[#331118] text-[#ff6b7d]",
											await: "border border-[#3a2a1a] bg-[#1d1208] text-[#9a8c74]",
											refund: "border border-[#3a2a1a] bg-[#1d1208] text-[#d9cfba]",
											cancel: "border border-[#3a2a1a] bg-[#1d1208] text-[#9a8c74]",
										}[st.key] ?? "border border-[#3a2a1a] bg-[#1d1208] text-[#9a8c74]";
										return (
											<tr
												key={`${o.kind}-${o.id}`}
												className="cursor-pointer border-t border-[#2a1c10] hover:bg-[#f54900]/[0.03]"
												onClick={() => void open(o)}
											>
												<td className="px-4 py-3 font-mono text-xs font-semibold text-[#ffe4a6]">
													{o.number}
												</td>
												<td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[#9a8c74]">
													{dt(o.date)}
												</td>
												<td className="px-4 py-3">
													<div className="text-xs font-semibold text-[#f7efe0]">
														{o.customer}
													</div>
													<div className="text-[11px] text-[#9a8c74]">{o.email}</div>
												</td>
												<td className="whitespace-nowrap px-4 py-3 text-xs">{o.method}</td>
												<td className="px-4 py-3 text-right font-mono text-xs">{eur(o.orderedEur)}</td>
												<td className="px-4 py-3 text-right font-mono text-xs">
													{o.receivedEur > 0 ? eur(o.receivedEur) : "—"}
												</td>
												<td className="px-4 py-3 text-right font-mono text-xs">
													{o.tokensCredited > 0 ? o.tokensCredited.toLocaleString("en-US") : "—"}
												</td>
												<td className="px-4 py-3">
													<span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${pill}`}>
														{st.label}
													</span>
												</td>
												<td className="px-4 py-3 text-xs font-semibold text-[#f3913e] hover:text-[#ffe4a6]">
													View →
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
						<p className="mt-3 text-[11px] text-[#9a8c74]">
							Showing {filtered.length} of {orders.length} orders · Signed in as {email}
						</p>
					</>
				) : (
					<OrderDetail
						row={selected}
						detail={detail}
						loading={detailLoading}
						notice={notice}
						onBack={() => {
							setSelected(null);
							setDetail(null);
							void load();
						}}
						onChanged={refreshDetail}
					/>
				)}
			</div>
		</div>
	);
}

function OrderDetail({
	row,
	detail,
	loading,
	notice,
	onBack,
	onChanged,
}: {
	row: OrderRow;
	detail: BankDetail | null;
	loading: boolean;
	notice: string;
	onBack: () => void;
	onChanged: () => Promise<void>;
}) {
	const [tab, setTab] = useState("overview");
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [refundOpen, setRefundOpen] = useState(false);
	const [busy, setBusy] = useState("");
	const [msg, setMsg] = useState("");

	const st = STATUS[row.status] ?? { key: row.status, label: row.status };
	const o = detail?.order;
	const credited = row.status === "credited";
	const closed = ["credited", "refunded", "cancelled"].includes(row.status);

	const resend = async () => {
		setBusy("resend");
		setMsg("");
		try {
			await req("/api/payments/receipt", {
				method: "POST",
				body: JSON.stringify({ method: row.kind, orderId: row.id }),
			});
			setMsg("Receipt email resent. Tokens are not credited again.");
		} catch (e) {
			setMsg((e as Error).message);
		} finally {
			setBusy("");
		}
	};

	return (
		<div>
			<button
				type="button"
				onClick={onBack}
				className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#9a8c74] hover:text-[#ffe4a6]"
			>
				<ArrowLeft size={14} /> Back to Orders
			</button>

			<div className="mb-5 flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-wrap items-center gap-3">
					<h2 className="font-mono text-xl font-semibold text-[#f7efe0]">{row.number}</h2>
					<span
						className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
							{
								paid: "bg-[#0f2e1a] text-[#3ee06a]",
								review: "bg-[#33220f] text-[#f5a623]",
								needs: "bg-[#331118] text-[#ff6b7d]",
							}[st.key] ?? "border border-[#3a2a1a] bg-[#1d1208] text-[#9a8c74]"
						}`}
					>
						{st.label}
					</span>
				</div>
				<div className="flex flex-wrap gap-2">
					{row.kind === "bank" && !closed && (
						<button
							type="button"
							onClick={() => setConfirmOpen(true)}
							className="inline-flex items-center gap-1.5 rounded-lg bg-[#f54900] px-4 py-2 text-xs font-bold text-white hover:bg-[#f3913e]"
						>
							<Check size={14} /> Confirm Bank Transfer
						</button>
					)}
					{row.kind === "bank" && credited && (
						<button
							type="button"
							onClick={() => setRefundOpen(true)}
							className="inline-flex items-center gap-1.5 rounded-lg border border-[#3a2a1a] bg-[#1d1208] px-3 py-2 text-xs font-bold text-[#d9cfba] hover:text-white"
						>
							<Undo2 size={14} /> Record Refund
						</button>
					)}
					{credited && (
						<button
							type="button"
							disabled={busy === "resend"}
							onClick={() => void resend()}
							className="inline-flex items-center gap-1.5 rounded-lg border border-[#3a2a1a] bg-[#1d1208] px-3 py-2 text-xs font-bold text-[#d9cfba] hover:text-white disabled:opacity-60"
						>
							<RefreshCw size={14} /> Resend Email
						</button>
					)}
					{row.kind === "card" && (
						<a
							href={`/api/payments/invoice?orderId=${row.id}`}
							className="inline-flex items-center gap-1.5 rounded-lg border border-[#3a2a1a] bg-[#1d1208] px-3 py-2 text-xs font-bold text-[#d9cfba] hover:text-white"
						>
							<Download size={14} /> Invoice PDF
						</a>
					)}
				</div>
			</div>

			<div className="mb-5 grid gap-3 sm:grid-cols-3">
				<div className="rounded-xl border border-[#2a1c10] bg-[#160d06] p-4">
					<div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#9a8c74]">Ordered</div>
					<div className="font-mono text-xl text-[#f7efe0]">{eur(row.orderedEur)}</div>
					<div className="text-xs text-[#9a8c74]">{row.tokensOrdered.toLocaleString("en-US")} tokens</div>
				</div>
				<div className="rounded-xl border border-[#2a1c10] bg-[#160d06] p-4">
					<div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#9a8c74]">Received</div>
					<div className="font-mono text-xl text-[#ffe4a6]">
						{row.receivedEur > 0 ? eur(row.receivedEur) : "—"}
					</div>
					<div className="text-xs text-[#9a8c74]">
						{row.receivedEur > 0 ? "Bank receipt recorded" : "Awaiting bank receipt"}
					</div>
				</div>
				<div className="rounded-xl border border-[#2a1c10] bg-[#160d06] p-4">
					<div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#9a8c74]">Tokens Credited</div>
					<div className="font-mono text-xl text-[#f7efe0]">
						{row.tokensCredited > 0 ? row.tokensCredited.toLocaleString("en-US") : "—"}
					</div>
					<div className="text-xs text-[#9a8c74]">Credited after confirmation</div>
				</div>
			</div>

			{row.receivedEur > 0 && row.receivedEur !== row.orderedEur && (
				<div className="mb-5 flex items-start gap-2.5 rounded-lg border border-[#6b4a12] bg-[#33220f] px-3.5 py-3 text-xs text-[#ffe4a6]">
					<ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#f5a623]" />
					<span>
						Received {eur(row.receivedEur)} differs from the ordered {eur(row.orderedEur)}. Tokens are credited by the
						actual amount; the order closes without waiting for the difference.
					</span>
				</div>
			)}

			{(msg || notice) && (
				<div
					className={`mb-5 rounded-lg border px-3.5 py-2.5 text-xs ${
						msg.includes("differ") || notice
							? "border-[#6b4a12] bg-[#33220f] text-[#ffe4a6]"
							: "border-[#1f8a3b] bg-[#0f2e1a] text-[#7dffa8]"
					}`}
				>
					{msg || notice}
				</div>
			)}

			{row.kind === "card" ? (
				<div className="rounded-xl border border-[#2a1c10] bg-[#160d06] p-5">
					<h3 className="mb-3 border-b border-[#2a1c10] pb-2 text-[10px] font-bold uppercase tracking-wider text-[#9a8c74]">
						Payment
					</h3>
					<dl className="grid gap-2 text-xs sm:grid-cols-[150px_1fr]">
						{[
							["Customer", row.customer],
							["Email", row.email],
							["Method", "Card (Infini)"],
							["Amount", eur(row.orderedEur)],
							["Tokens", row.tokensOrdered.toLocaleString("en-US")],
							["Created", dt(row.date)],
							["Status", st.label],
						].map(([k, v]) => (
							<div key={k} className="contents">
								<dt className="text-[#9a8c74]">{k}</dt>
								<dd className="text-[#f7efe0]">{v}</dd>
							</div>
						))}
					</dl>
				</div>
			) : loading ? (
				<p className="py-8 text-center text-sm text-[#9a8c74]">
					<Loader2 size={16} className="mr-2 inline animate-spin" /> Loading order details…
				</p>
			) : detail && o ? (
				<>
					<div className="mb-5 flex flex-wrap gap-1 border-b border-[#2a1c10]">
						{[
							["overview", "Overview"],
							["docs", `Documents ${detail.docs.length ? `(${detail.docs.length})` : ""}`],
							["emails", `Emails ${detail.mail ? "(1)" : ""}`],
							["history", `History (${detail.history.length})`],
						].map(([k, label]) => (
							<button
								key={k}
								type="button"
								onClick={() => setTab(k)}
								className={`px-3.5 py-2.5 text-[13px] font-semibold ${
									tab === k
										? "border-b-2 border-[#f54900] text-[#ffe4a6]"
										: "text-[#9a8c74] hover:text-white"
								}`}
							>
								{label}
							</button>
						))}
					</div>

					{tab === "overview" && (
						<div className="grid gap-3 lg:grid-cols-2">
							<Section title="Buyer">
								<KV
									rows={[
										["Type", o.buyer?.kind === "company" ? "Company" : "Individual"],
										["Name", o.buyer?.fullName || o.buyer?.legalName || "—"],
										["Email", o.email],
										["Country", o.buyer?.country || "—"],
										["Address", o.buyer?.address || "—"],
										["Terms", `Version ${o.terms_version}, accepted ${dt(o.confirmed_at)}`],
									]}
								/>
							</Section>
							<Section title="Purchase">
								<KV
									rows={[
										["Item", "Prepaid Velora AI tokens"],
										["Ordered amount", eur(o.eur_amount)],
										["Ordered tokens", Number(o.tokens).toLocaleString("en-US")],
										["Rate", "€1 = 100 tokens"],
										["Method", "Bank Transfer"],
										[
											"Payment reference",
											detail.docs.find((d: any) => d.kind === "invoice")?.doc_number ?? o.public_number,
										],
									]}
								/>
							</Section>
							<Section title="Receipt">
								<KV
									rows={[
										["Status", st.label],
										[
											"Received amount",
											detail.payments.length
												? eur(detail.payments.reduce((n: number, p: any) => n + Number(p.amount_cents), 0) / 100)
												: "—",
										],
										["Payer name", row.payer || "—"],
										[
											"Bank reference",
											detail.payments.map((p: any) => p.bank_ref).filter(Boolean).join(", ") || "—",
										],
										[
											"Tokens credited",
											o.credited_tokens ? Number(o.credited_tokens).toLocaleString("en-US") : "—",
										],
									]}
								/>
							</Section>
							<Section title="Refunds">
								{detail.refunds.length === 0 ? (
									<p className="text-xs text-[#9a8c74]">No refunds recorded.</p>
								) : (
									detail.refunds.map((r: any) => (
										<p key={r.id} className="text-xs">
											{eur(Number(r.amount_cents) / 100)} · {r.status} · {r.reason}
											<span className="text-[#9a8c74]"> · {dt(r.decided_at)}</span>
										</p>
									))
								)}
							</Section>
						</div>
					)}

					{tab === "docs" && (
						<Section title="Order Documents">
							{detail.docs.map((d: any) => (
								<DocRow
									key={d.id}
									name={DOC_LABEL[d.kind] ?? d.kind}
									meta={`${d.doc_number} · ${dt(d.created_at)}`}
									href={`/api/bank-transfer/documents?kind=document&doc=${d.id}`}
								/>
							))}
							{detail.evidence
								.filter((e: any) => e.uploaded_by !== "system")
								.map((e: any) => (
									<DocRow
										key={e.id}
										name={e.file_name}
										meta={`Bank evidence · ${dt(e.created_at)}`}
										href={`/api/bank-transfer/documents?evidenceId=${e.id}`}
									/>
								))}
							<div className="pt-2">
								<a
									href={`/api/bank-transfer/admin?action=dossier&orderId=${o.id}`}
									className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#f3913e] hover:text-[#ffe4a6]"
								>
									<Download size={13} /> Download dossier (ZIP)
								</a>
							</div>
						</Section>
					)}

					{tab === "emails" && (
						<Section title="Emails to Customer">
							{detail.mail ? (
								<div>
									<div className="flex flex-wrap items-center gap-2 pb-3">
										<span
											className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
												detail.mail.state === "sent"
													? "bg-[#0f2e1a] text-[#3ee06a]"
													: "bg-[#331118] text-[#ff6b7d]"
											}`}
										>
											{detail.mail.state === "sent" ? "Sent" : "Not sent"}
										</span>
										<span className="text-xs font-semibold text-[#f7efe0]">{detail.mail.subject}</span>
										<span className="text-[11px] text-[#9a8c74]">
											to {detail.mail.to_email} · {dt(detail.mail.sent_at)}
										</span>
									</div>
									<pre className="overflow-x-auto rounded-lg border border-[#2a1c10] bg-[#1d1208] p-4 text-[11px] leading-relaxed whitespace-pre-wrap text-[#d9cfba]">
										{detail.mail.body}
									</pre>
								</div>
							) : (
								<p className="text-xs text-[#9a8c74]">No email recorded yet.</p>
							)}
						</Section>
					)}

					{tab === "history" && (
						<Section title="History">
							<ul>
								{[...detail.history].reverse().map((h: any) => (
									<li key={h.id} className="flex gap-3 border-b border-[#2a1c10] py-2.5 last:border-0">
										<span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#f3913e]" />
										<div>
											<div className="text-xs font-semibold text-[#f7efe0]">
												{HISTORY_LABEL[h.action] ?? h.action.replace(/\./g, " ")}
											</div>
											<div className="font-mono text-[10px] text-[#9a8c74]">
												{dt(h.created_at)} · {h.actor_email}
												{h.detail?.reason ? ` · ${h.detail.reason}` : ""}
												{h.detail?.tokens ? ` · ${Number(h.detail.tokens).toLocaleString("en-US")} tokens` : ""}
											</div>
										</div>
									</li>
								))}
							</ul>
						</Section>
					)}
				</>
			) : null}

			{confirmOpen && (
				<ConfirmDialog
					row={row}
					onClose={() => setConfirmOpen(false)}
					onDone={async (m) => {
						setConfirmOpen(false);
						setMsg(m);
						await onChanged();
					}}
				/>
			)}
			{refundOpen && (
				<RefundDialog
					row={row}
					onClose={() => setRefundOpen(false)}
					onDone={async (m) => {
						setRefundOpen(false);
						setMsg(m);
						await onChanged();
					}}
				/>
			)}
		</div>
	);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className="rounded-xl border border-[#2a1c10] bg-[#160d06] p-5">
			<h3 className="mb-3 border-b border-[#2a1c10] pb-2 text-[10px] font-bold uppercase tracking-wider text-[#9a8c74]">
				{title}
			</h3>
			{children}
		</section>
	);
}

function KV({ rows }: { rows: [string, string][] }) {
	return (
		<dl className="grid gap-x-4 gap-y-2 text-xs">
			{rows.map(([k, v]) => (
				<div key={k} className="grid grid-cols-[130px_1fr] gap-3 sm:grid-cols-[150px_1fr]">
					<dt className="text-[#9a8c74]">{k}</dt>
					<dd className="min-w-0 break-words text-[#f7efe0]">{v}</dd>
				</div>
			))}
		</dl>
	);
}

function DocRow({ name, meta, href }: { name: string; meta: string; href: string }) {
	return (
		<div className="flex items-center gap-3 border-b border-[#2a1c10] py-2.5 last:border-0">
			<div>
				<div className="text-xs font-semibold text-[#f7efe0]">{name}</div>
				<div className="font-mono text-[10px] text-[#9a8c74]">{meta}</div>
			</div>
			<a
				href={href}
				className="ml-auto inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-[#f3913e] hover:text-[#ffe4a6]"
			>
				<Download size={13} /> Download PDF
			</a>
		</div>
	);
}

function ConfirmDialog({
	row,
	onClose,
	onDone,
}: {
	row: OrderRow;
	onClose: () => void;
	onDone: (msg: string) => Promise<void>;
}) {
	const [amount, setAmount] = useState(String(row.orderedEur));
	const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
	const [payer, setPayer] = useState(row.customer);
	const [bankRef, setBankRef] = useState("");
	const [comment, setComment] = useState("");
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState("");

	const tokens = Math.floor(Number(amount) || 0) * 100;
	const differs = Number(amount) !== row.orderedEur;

	const submit = async () => {
		const amt = Number(amount);
		if (!Number.isFinite(amt) || amt <= 0) {
			setErr("Enter the received amount in EUR.");
			return;
		}
		setBusy(true);
		setErr("");
		try {
			await req("/api/bank-transfer/admin?action=payment", {
				method: "POST",
				body: JSON.stringify({
					orderId: row.id,
					senderName: payer.trim() || row.customer,
					amount: amt,
					currency: "EUR",
					receivedDate: date,
					bankRef: bankRef.trim() || null,
					paymentRef: `manual-${row.number}`,
					matchBasis: `Manual confirmation via Admin (${comment.trim() || "bank statement"})`,
					idempotencyKey: crypto.randomUUID(),
				}),
			});
			const r = await req<{ review?: boolean; message?: string }>(
				"/api/bank-transfer/admin?action=credit",
				{
					method: "POST",
					body: JSON.stringify({ orderId: row.id, note: comment.trim() }),
				},
			);
			await onDone(
				r.review
					? (r.message ?? "Left on manual review.")
					: `Confirmed ${eur(amt)} received and credited ${tokens.toLocaleString("en-US")} tokens.`,
			);
		} catch (e) {
			setErr((e as Error).message);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div
			className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="w-full max-w-md rounded-2xl border border-[#3a2a1a] bg-[#1f140b] p-6 shadow-2xl">
				<div className="mb-4 flex items-center justify-between">
					<h3 className="text-lg font-bold text-white">Confirm Bank Transfer</h3>
					<button type="button" onClick={onClose} aria-label="Close" className="text-[#8a7e6f] hover:text-white">
						<X size={18} />
					</button>
				</div>
				<div className="grid gap-3">
					<Field label="Received Amount (EUR)">
						<input
							type="number"
							min={0}
							step={0.01}
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							className={inputCls}
						/>
					</Field>
					<Field label="Payment Date">
						<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
					</Field>
					<Field label="Payer Name">
						<input value={payer} onChange={(e) => setPayer(e.target.value)} className={inputCls} />
					</Field>
					<Field label="Bank Reference (optional)">
						<input value={bankRef} onChange={(e) => setBankRef(e.target.value)} className={inputCls} />
					</Field>
					<Field label="Internal Comment (optional)">
						<textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className={inputCls} />
					</Field>
				</div>
				{differs && (
					<div className="mt-3 flex items-start gap-2 rounded-lg border border-[#6b4a12] bg-[#33220f] px-3 py-2.5 text-xs text-[#ffe4a6]">
						<Coins size={14} className="mt-0.5 shrink-0 text-[#f5a623]" />
						<span>
							Ordered {eur(row.orderedEur)}, received {eur(Number(amount) || 0)}. Tokens are recalculated by the
							actual amount and the order closes.
						</span>
					</div>
				)}
				{err && <p className="mt-3 rounded-lg border border-[#e93e3a] bg-[#2b0f0b] px-3 py-2 text-xs text-[#ff9988]">{err}</p>}
				<div className="mt-5 flex gap-2">
					<button
						type="button"
						disabled={busy}
						onClick={() => void submit()}
						className="flex-1 rounded-xl bg-[#f54900] px-4 py-3 text-sm font-bold text-white hover:bg-[#f3913e] disabled:opacity-60"
					>
						{busy ? "Confirming…" : `Confirm ${eur(Number(amount) || 0)} and credit ${tokens.toLocaleString("en-US")} tokens`}
					</button>
					<button
						type="button"
						onClick={onClose}
						className="rounded-xl border border-[#3a2a1a] bg-[#1d1208] px-4 py-3 text-sm font-bold text-[#d9cfba]"
					>
						Cancel
					</button>
				</div>
				<p className="mt-3 text-[11px] leading-relaxed text-[#8a7e6f]">
					Tokens are credited once — repeating the confirmation never credits twice. The customer receives the
					Payment received email automatically.
				</p>
			</div>
		</div>
	);
}

function RefundDialog({
	row,
	onClose,
	onDone,
}: {
	row: OrderRow;
	onClose: () => void;
	onDone: (msg: string) => Promise<void>;
}) {
	const [amount, setAmount] = useState(String(row.receivedEur || row.orderedEur));
	const [reason, setReason] = useState("");
	const [bankRef, setBankRef] = useState("");
	const [tokens, setTokens] = useState("0");
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState("");

	const submit = async () => {
		if (reason.trim().length < 2) {
			setErr("Enter the refund reason.");
			return;
		}
		setBusy(true);
		setErr("");
		try {
			await req("/api/bank-transfer/admin?action=refund", {
				method: "POST",
				body: JSON.stringify({
					orderId: row.id,
					amount: Number(amount),
					status: "executed",
					reason: reason.trim(),
					bankRef: bankRef.trim(),
					tokenCorrection: Number(tokens) || 0,
				}),
			});
			await onDone("Refund recorded. Financial records are kept in the order history.");
		} catch (e) {
			setErr((e as Error).message);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div
			className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="w-full max-w-md rounded-2xl border border-[#3a2a1a] bg-[#1f140b] p-6 shadow-2xl">
				<div className="mb-4 flex items-center justify-between">
					<h3 className="text-lg font-bold text-white">Record Refund</h3>
					<button type="button" onClick={onClose} aria-label="Close" className="text-[#8a7e6f] hover:text-white">
						<X size={18} />
					</button>
				</div>
				<p className="mb-4 text-xs leading-relaxed text-[#9a8c74]">
					Records a refund already executed at the bank. This form does not send any money.
				</p>
				<div className="grid gap-3">
					<Field label="Refund Amount (EUR)">
						<input type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
					</Field>
					<Field label="Reason">
						<textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={inputCls} />
					</Field>
					<Field label="Bank Reference (optional)">
						<input value={bankRef} onChange={(e) => setBankRef(e.target.value)} className={inputCls} />
					</Field>
					<Field label="Token Correction (deducted from balance)">
						<input type="number" min={0} value={tokens} onChange={(e) => setTokens(e.target.value)} className={inputCls} />
					</Field>
				</div>
				{err && <p className="mt-3 rounded-lg border border-[#e93e3a] bg-[#2b0f0b] px-3 py-2 text-xs text-[#ff9988]">{err}</p>}
				<div className="mt-5 flex gap-2">
					<button
						type="button"
						disabled={busy}
						onClick={() => void submit()}
						className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#f54900] px-4 py-3 text-sm font-bold text-white hover:bg-[#f3913e] disabled:opacity-60"
					>
						<RotateCcw size={14} /> {busy ? "Saving…" : "Record Refund"}
					</button>
					<button
						type="button"
						onClick={onClose}
						className="rounded-xl border border-[#3a2a1a] bg-[#1d1208] px-4 py-3 text-sm font-bold text-[#d9cfba]"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
}

const inputCls =
	"w-full rounded-lg border border-[#3a2a1a] bg-[#24160c] px-3 py-2 text-sm text-[#ffe4a6] outline-none placeholder:text-[#8a7e6f]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<label className="block">
			<span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#9a8c74]">{label}</span>
			{children}
		</label>
	);
}

