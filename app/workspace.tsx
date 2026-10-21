"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
	ArrowRight,
	ArrowUpRight,
	Coins,
	Clapperboard,
	Image as ImageIcon,
	Menu,
	MessageCircle,
	Paperclip,
	Plus,
	X,
} from "lucide-react";
import { TOKEN_PACKAGES } from "@/lib/commerce";
import { COMPANY, TOKENS_PER_EUR } from "@/lib/company";
import { presets } from "@/lib/presets";
import { VeloraLogo } from "./logo";

type Mode = "text" | "image" | "video";
type Account = { id: string; email: string; tokens?: number; email_verified?: boolean };
type TokenOrder = { id: string; eur_amount: number; tokens: number; status: string; admin_note?: string; created_at: string; decided_at?: string | null; email?: string; user_id?: string };
type Space = { id: string; title: string; mode: Mode };
type Run = {
	id: string;
	mode: Mode;
	prompt: string;
	result: string | null;
	tokens_spent?: number;
	status: string;
	error: string | null;
};

const modes: {
	key: Mode;
	title: string;
	cost: number;
	subtitle: string;
	icon: typeof MessageCircle;
}[] = [
	{
		key: "text",
		title: "Chat & Script",
		cost: 5,
		subtitle: "Prompt & script generation (legacy rate: 5 tokens)",
		icon: MessageCircle,
	},
	{
		key: "image",
		title: "Image Studio",
		cost: 25,
		subtitle: "AI image generation (legacy rate: 25 tokens)",
		icon: ImageIcon,
	},
	{
		key: "video",
		title: "Video Studio",
		cost: 100,
		subtitle: "Automated AI video generation (legacy rate: 100 tokens)",
		icon: Clapperboard,
	},
];

async function request<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, {
		...init,
		headers: { "Content-Type": "application/json", ...init?.headers },
	});
	const body = await response.json();
	if (!response.ok) throw new Error(body.error || "Something went wrong.");
	return body as T;
}

export function Workspace() {
	const searchParams = useSearchParams();
	const requestedMode = searchParams.get("mode");
	const [mode, setMode] = useState<Mode>(
		requestedMode === "text" ||
			requestedMode === "image" ||
			requestedMode === "video"
			? requestedMode
			: "video",
	);
	const [account, setAccount] = useState<Account | null>(null);
	const [verifyNotice, setVerifyNotice] = useState("");
	const [resendBusy, setResendBusy] = useState(false);
	const [tokens, setTokens] = useState<number>(0);
	const [spaces, setSpaces] = useState<Space[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [runs, setRuns] = useState<Run[]>([]);
	const [prompt, setPrompt] = useState(
		searchParams.get("prompt")?.slice(0, 8000) ?? "",
	);
	const [reference, setReference] = useState<string | undefined>();
	const [aspectRatio, setAspectRatio] = useState("16:9");
	const [duration, setDuration] = useState(6);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [authOpen, setAuthOpen] = useState(false);
	const [topupOpen, setTopupOpen] = useState(
		searchParams.get("topup") === "open",
	);
	const [authMode, setAuthMode] = useState<"register" | "login">("register");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [menuOpen, setMenuOpen] = useState(false);
	const [topupSuccess, setTopupSuccess] = useState("");
	const [customEur, setCustomEur] = useState(20);
	const [orders, setOrders] = useState<TokenOrder[]>([]);
	const [isAdmin, setIsAdmin] = useState(false);
 const [onlineEnabled, setOnlineEnabled] = useState(false);
 const [paymentOrders, setPaymentOrders] = useState<TokenOrder[]>([]);
 const [checkoutRequest, setCheckoutRequest] = useState<{packageId: string; requestId: string} | null>(null);
	const [orderMsg, setOrderMsg] = useState("");
	const [adminNote, setAdminNote] = useState("");
	const [adminBusyId, setAdminBusyId] = useState("");

	// Drawers and dialogs must not scroll the background page.
	useEffect(() => {
		if (!menuOpen && !authOpen && !topupOpen) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		const close = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setMenuOpen(false);
				setAuthOpen(false);
				setTopupOpen(false);
			}
		};
		window.addEventListener("keydown", close);
		return () => {
			document.body.style.overflow = previous;
			window.removeEventListener("keydown", close);
		};
	}, [menuOpen, authOpen, topupOpen]);

	const loadSpaces = useCallback(async () => {
		try {
			const data = await request<{ workspaces: Space[] }>("/api/workspaces");
			setSpaces(data.workspaces);
		} catch (e) {
			setError((e as Error).message);
		}
	}, []);

	const refreshTokens = useCallback(async () => {
		try {
			const data = await request<{ tokens: number }>("/api/tokens");
			setTokens(data.tokens);
		} catch {
			/* Ignore if not logged in */
		}
	}, []);

	const refreshOrders = useCallback(async () => {
		try {
			const data = await request<{ orders: TokenOrder[]; isAdmin: boolean }>("/api/orders");
			setOrders(data.orders);
			setIsAdmin(data.isAdmin);
		} catch {
			/* Guest mode or unavailable */
		}
	}, []);

	useEffect(() => {
		if (topupOpen && account) void refreshOrders();
	}, [topupOpen, account, refreshOrders]);


 const refreshPayments = useCallback(async (orderId?: string) => {
   try {
     const data = await request<{enabled: boolean; orders: TokenOrder[]}>(`/api/payments${orderId ? `?orderId=${encodeURIComponent(orderId)}` : ""}`);
     setOnlineEnabled(data.enabled);
     setPaymentOrders(data.orders);
     if (orderId) {
       const order = data.orders.find(o => o.id === orderId);
       setOrderMsg(order?.status === "credited" ? "Payment confirmed. Tokens credited." : "Payment is not confirmed yet. Use Check payment status to refresh. Do not pay again while confirmation is pending.");
       void refreshTokens();
     }
   } catch (e) { setError((e as Error).message); }
 }, [refreshTokens]);
 useEffect(() => {
   if (topupOpen && account) void refreshPayments(searchParams.get("paymentOrder") || undefined);
 }, [topupOpen, account, refreshPayments, searchParams]);

 async function checkout(packageId: keyof typeof TOKEN_PACKAGES) {
   if (!account) { setAuthOpen(true); return; }
   setBusy(true); setError(""); setOrderMsg("");
   // Keep UUID across ambiguous timeouts/reloads and switching back to the same package.
   const key = `velora-checkout:${account.id}:${packageId}`;
   try {
     const requestId = sessionStorage.getItem(key) || crypto.randomUUID();
     sessionStorage.setItem(key, requestId);
     setCheckoutRequest({packageId, requestId});
     const result = await request<{checkoutUrl: string; orderId: string}>("/api/payments/checkout", {
       method: "POST", body: JSON.stringify({packageId, requestId}),
     });
     window.location.assign(result.checkoutUrl);
   } catch (e) { setError((e as Error).message); }
   finally { setBusy(false); }
 }

	async function placeOrder(eurAmount: number) {
		if (!account) {
			setAuthOpen(true);
			return;
		}
		setBusy(true);
		setError("");
		setOrderMsg("");
		try {
			const res = await request<{ order: TokenOrder }>("/api/orders", {
				method: "POST",
				body: JSON.stringify({ eurAmount }),
			});
			setOrderMsg(`Order placed: €${res.order.eur_amount} = ${res.order.tokens.toLocaleString("en-US")} tokens. Status: pending invoice.`);
			void refreshOrders();
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setBusy(false);
		}
	}

	async function decideOrder(id: string, action: "invoiced" | "credited" | "cancelled") {
		setAdminBusyId(id);
		setError("");
		try {
			await request("/api/orders", {
				method: "PATCH",
				body: JSON.stringify({ id, action, adminNote }),
			});
			void refreshOrders();
			void refreshTokens();
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setAdminBusyId("");
		}
	}

	useEffect(() => {
		request<{ user: Account | null }>("/api/auth")
			.then((data) => {
				setAccount(data.user);
				if (data.user) {
					if (typeof data.user.tokens === "number") {
						setTokens(data.user.tokens);
					} else {
						void refreshTokens();
					}
					void loadSpaces();
				}
			})
			.catch(() => {
				/* Guest mode */
			});
	}, [loadSpaces, refreshTokens]);

	useEffect(() => {
		if (searchParams.get("auth") === "open" && !account) {
			setAuthOpen(true);
		}
		if (searchParams.get("verified") === "1" && !account) {
			setAuthOpen(true);
			setAuthMode("login");
			setVerifyNotice(
				"Email confirmed. Sign in with your password to continue.",
			);
		}
	}, [searchParams, account]);

	useEffect(() => {
		if (!activeId) {
			setRuns([]);
			return;
		}
		request<{ runs: Run[] }>(
			`/api/runs?workspaceId=${encodeURIComponent(activeId)}`,
		)
			.then((data) => setRuns(data.runs))
			.catch((e) => setError(e.message));
	}, [activeId]);

	useEffect(() => {
		const pending = runs.filter(
			(run) => run.mode === "video" && run.status === "pending",
		);
		if (!pending.length) return;
		const timer = window.setInterval(() => {
			for (const run of pending)
				request<{ status: string; result: string | null }>(
					`/api/video-status?id=${run.id}`,
				)
					.then((data) => {
						setRuns((prev) =>
							prev.map((item) =>
								item.id === run.id
									? { ...item, status: data.status, result: data.result }
									: item,
							),
						);
						if (data.status === "completed") {
							void refreshTokens();
						}
					})
					.catch((e) => setError(e.message));
		}, 10000);
		return () => window.clearInterval(timer);
	}, [runs, refreshTokens]);

	function chooseMode(value: Mode) {
		setMode(value);
		setActiveId(null);
		setRuns([]);
		setPrompt("");
		setReference(undefined);
		setError("");
		setMenuOpen(false);
	}

	async function resendVerification(targetEmail?: string) {
		const target = (targetEmail ?? email).trim();
		if (!target) return;
		setResendBusy(true);
		setError("");
		try {
			await request("/api/auth/verify", {
				method: "POST",
				body: JSON.stringify({ email: target }),
			});
			setVerifyNotice(
				"Confirmation link sent. Check your inbox (and spam folder). The link is valid for 24 hours.",
			);
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setResendBusy(false);
		}
	}

	async function authenticate(event: React.FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError("");
		setVerifyNotice("");
		try {
			const data = await request<{
				user: Account;
				needsVerification?: boolean;
				emailSent?: boolean;
				devVerifyLink?: string;
			}>(
				`/api/auth?action=${authMode}`,
				{ method: "POST", body: JSON.stringify({ email, password }) },
			);
			if (data.needsVerification) {
				setVerifyNotice(
					data.emailSent
						? "Account created. Check your inbox for the confirmation link (valid 24 hours), then sign in."
						: "Account created, but the confirmation email could not be sent yet. Use Resend below.",
				);
				if (data.devVerifyLink)
					setVerifyNotice(
						(prev) => `${prev} Dev link: ${data.devVerifyLink}`,
					);
				setAuthMode("login");
				setPassword("");
				return;
			}
			setAccount(data.user);
			if (typeof data.user.tokens === "number") {
				setTokens(data.user.tokens);
			} else {
				await refreshTokens();
			}
			setAuthOpen(false);
			setPassword("");
			setVerifyNotice("");
			await loadSpaces();
		} catch (e) {
			const msg = (e as Error).message;
			setError(msg);
			if (/confirm your email/i.test(msg)) {
				setVerifyNotice(
					"Your email is not confirmed yet. Check your inbox or resend the link below.",
				);
			}
		} finally {
			setBusy(false);
		}
	}

	async function signOut() {
		try {
			await request("/api/auth", { method: "DELETE" });
			setAccount(null);
			setTokens(0);
			setSpaces([]);
			setActiveId(null);
			setRuns([]);
		} catch (e) {
			setError((e as Error).message);
		}
	}

	async function newSpace(currentMode = mode) {
		const data = await request<{ workspace: Space }>("/api/workspaces", {
			method: "POST",
			body: JSON.stringify({
				mode: currentMode,
				title: `Untitled ${currentMode === "text" ? "chat" : currentMode + " project"}`,
			}),
		});
		setSpaces((prev) => [data.workspace, ...prev]);
		setActiveId(data.workspace.id);
		return data.workspace.id;
	}

	async function topup(packageId: keyof typeof TOKEN_PACKAGES) {
		if (!account) {
			setAuthOpen(true);
			return;
		}
		setBusy(true);
		setError("");
		setTopupSuccess("");
		try {
			const res = await request<{
				tokens: number;
				added: number;
				message: string;
			}>("/api/tokens", {
				method: "POST",
				body: JSON.stringify({ packageId }),
			});
			setTokens(res.tokens);
			setTopupSuccess(
				`Successfully added +${res.added.toLocaleString()} tokens!`,
			);
			setTimeout(() => {
				setTopupOpen(false);
				setTopupSuccess("");
			}, 1800);
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setBusy(false);
		}
	}

	async function generate(event: React.FormEvent) {
		event.preventDefault();
		if (!prompt.trim() || busy) return;
		if (!account) {
			setAuthOpen(true);
			setError(
				"Create an account or sign in to access token balance and AI generations.",
			);
			return;
		}
		const cost = modes.find((m) => m.key === mode)?.cost ?? 10;
		if (tokens < cost) {
			setTopupOpen(true);
			setError(
				`You need at least ${cost} tokens for ${mode} generation (Current: ${tokens}).`,
			);
			return;
		}

		setBusy(true);
		setError("");
		try {
			const id =
				activeId && spaces.find((space) => space.id === activeId)?.mode === mode
					? activeId
					: await newSpace();
			const data = await request<{ run: Run; tokens?: number }>("/api/runs", {
				method: "POST",
				body: JSON.stringify({
					workspaceId: id,
					mode,
					prompt: prompt.trim(),
					reference,
					aspectRatio,
					duration,
				}),
			});
			setRuns((prev) => [...prev, data.run]);
			if (typeof data.tokens === "number") {
				setTokens(data.tokens);
			} else {
				void refreshTokens();
			}
			setPrompt("");
			setReference(undefined);
		} catch (e) {
			const msg = (e as Error).message;
			if (msg.includes("Insufficient tokens")) {
				setTopupOpen(true);
			}
			setError(msg);
		} finally {
			setBusy(false);
		}
	}

	function upload(file?: File) {
		if (!file) return;
		if (
			!["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
			file.size > 5_000_000
		) {
			setError("Choose a PNG, JPEG or WebP under 5 MB.");
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			setReference(String(reader.result));
			setError("");
		};
		reader.readAsDataURL(file);
	}

	const current = modes.find((item) => item.key === mode)!;
	const examples = presets[mode];

	return (
		<main className="shell">
			{/* Sidebar */}
			<aside
				id="studio-navigation"
				className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}
			>
				<div className="side-top flex items-center justify-between">
					<Link href="/" aria-label="Velora Home">
						<VeloraLogo size={32} />
					</Link>
					<button
						className="mobile-close text-[#8a7e6f] hover:text-white"
						onClick={() => setMenuOpen(false)}
						aria-label="Close menu"
					>
						<X size={20} />
					</button>
				</div>

				<div className="side-label">CREATIVE ENGINES</div>
				<nav className="side-nav" aria-label="Creative modes">
					{modes.map((item) => (
						<button
							key={item.key}
							aria-pressed={mode === item.key}
							className={`nav-item ${mode === item.key ? "selected" : ""}`}
							onClick={() => chooseMode(item.key)}
						>
							<item.icon size={18} strokeWidth={1.8} />
							<span className="flex-1 text-left">{item.title}</span>
							<span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#170d06] text-[#ffe4a6] border border-[#3a2a1a]">
								{item.cost}T
							</span>
							{mode === item.key && <span className="nav-indicator ml-1" />}
						</button>
					))}
				</nav>

				<div className="side-rule" />

				{/* Token balance card */}
				<div className="token-balance-widget">
					<div className="flex items-center justify-between text-xs text-[#8a7e6f] font-bold uppercase tracking-wider mb-1">
						<span>Token Balance</span>
						<Coins size={14} className="text-[#ffe4a6]" />
					</div>
					<div className="token-count">
						{account ? tokens.toLocaleString() : "0"}
						<span className="text-xs text-[#8a7e6f] font-normal">tokens</span>
					</div>
					<button
						className="token-topup-btn"
						onClick={() => (account ? setTopupOpen(true) : setAuthOpen(true))}
					>
						<Plus size={13} /> {account ? "Top Up Tokens" : "Create account"}
					</button>
				</div>

				<div className="side-label recent-label">
					<span>WORKSPACES</span>
					<button
						aria-label="New workspace"
						className="text-[#ffe4a6] hover:text-white"
						onClick={() =>
							account
								? newSpace().catch((e) => setError(e.message))
								: setAuthOpen(true)
						}
					>
						<Plus size={16} />
					</button>
				</div>
				<div className="recents">
					{spaces.length ? (
						spaces.map((space) => (
							<button
								className={`recent ${activeId === space.id ? "recent-active" : ""}`}
								key={space.id}
								onClick={() => {
									chooseMode(space.mode);
									setActiveId(space.id);
								}}
							>
								<span className="recent-icon text-[#f54900]">
									{space.mode === "text"
										? "✦"
										: space.mode === "image"
											? "◆"
											: "▶"}
								</span>
								<span className="truncate">{space.title}</span>
							</button>
						))
					) : (
						<p className="text-xs text-[#8a7e6f] px-2 py-3 leading-relaxed">
							{account
								? "No workspaces yet. Start with a prompt above!"
								: "Sign in to save and resume your projects."}
						</p>
					)}
				</div>

				<div className="side-bottom">
					{account ? (
						<div className="account-box justify-between">
							<div className="flex items-center gap-2 truncate">
								<span className="avatar">{account.email[0].toUpperCase()}</span>
								<span className="truncate text-xs font-semibold">
									{account.email}
								</span>
							</div>
							<button
								onClick={signOut}
								className="text-xs text-[#8a7e6f] hover:text-[#e93e3a] transition-colors"
							>
								Exit
							</button>
						</div>
					) : (
						<button
							className="account-box w-full justify-between hover:text-white"
							onClick={() => setAuthOpen(true)}
						>
							<div className="flex items-center gap-2">
								<span className="avatar bg-[#24160c] text-[#ffe4a6] border border-[#3a2a1a]">
									G
								</span>
								<span className="text-xs font-semibold">
									Guest · sign in to create
								</span>
							</div>
							<ArrowUpRight size={14} />
						</button>
					)}
				</div>
			</aside>

			{menuOpen && (
				<button
					className="overlay-mobile"
					aria-label="Close menu"
					onClick={() => setMenuOpen(false)}
				/>
			)}

			{/* Main Workspace Area */}
			<section className="main-area">
				<header className="topbar">
					<div className="studio-breadcrumb flex items-center gap-4 text-xs">
						<button
							className="mobile-menu-button text-[#ffe4a6]"
							aria-expanded={menuOpen}
							aria-controls="studio-navigation"
							aria-label="Open menu"
							onClick={() => setMenuOpen(true)}
						>
							<Menu size={22} />
						</button>
						<Link href="/" className="text-[#8a7e6f] hover:text-[#ffe4a6]">
							Velora
						</Link>
						<span className="text-[#3a2a1a]">/</span>
						<span className="font-bold text-white">{current.title}</span>
						<span className="text-[11px] px-2 py-0.5 rounded-full bg-[#24160c] text-[#ffe4a6] border border-[#3a2a1a]">
							Cost: {current.cost} tokens
						</span>
					</div>

					<div className="studio-account-actions flex items-center gap-4">
						<button
							onClick={() => (account ? setTopupOpen(true) : setAuthOpen(true))}
							className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#24160c] border border-[#3a2a1a] text-xs font-semibold text-[#ffe4a6] hover:border-[#f54900] transition-colors"
						>
							<Coins size={14} className="text-[#f54900]" />
							<span>{tokens.toLocaleString()} Tokens</span>
							<Plus size={12} className="opacity-70" />
						</button>

						{account ? (
							<div className="text-xs text-[#8a7e6f] hidden sm:block">
								{account.email}
							</div>
						) : (
							<button
								onClick={() => setAuthOpen(true)}
								className="text-xs font-bold text-[#ffe4a6] hover:text-white flex items-center gap-1"
							>
								Sign In <ArrowUpRight size={13} />
							</button>
						)}
					</div>
				</header>

				<div className="content-scroll">
					<div className="content-wrap">
						{/* Title block */}
						<div className="studio-title-block">
							<div className="text-[11px] font-extrabold uppercase tracking-widest text-[#f54900] flex items-center gap-2 mb-2">
								<span>ENGINE / {current.key.toUpperCase()}</span>
								<span>·</span>
								<span>DEDUCTION: {current.cost} TOKENS</span>
							</div>
							<h1 className="studio-headline">
								{mode === "text"
									? "Craft scripts, scenes & prompts."
									: mode === "image"
										? "Generate photorealistic visuals."
										: "Render cinematic 2K video motion."}
							</h1>
							<p className="studio-subtitle">{current.subtitle}</p>
						</div>

						{/* Error notice */}
						{error && (
							<div className="mb-6 p-4 rounded-xl bg-[#2b0f0b] border border-[#e93e3a] text-sm text-[#ff9988] flex items-center justify-between">
								<span>{error}</span>
								<button onClick={() => setError("")} aria-label="Dismiss error">
									<X size={16} />
								</button>
							</div>
						)}

						{/* Prompt composer */}
						<form className="composer-box" onSubmit={generate}>
							<textarea
								className="composer-textarea"
								aria-label="Enter your generation prompt"
								placeholder={
									mode === "text"
										? "Write a prompt, ask for a video script breakdown, or develop visual concepts..."
										: mode === "image"
											? "Describe a cinematic scene with lighting, lens details, and mood..."
											: "Describe a video shot: camera movement, subject action, atmosphere and pacing..."
								}
								value={prompt}
								onChange={(e) => setPrompt(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
										e.preventDefault();
										void generate(e);
									}
								}}
							/>

							{reference && (
								<div className="inline-flex items-center gap-2 bg-[#2a1c10] border border-[#3a2a1a] text-xs text-[#ffe4a6] px-3 py-1.5 rounded-lg mb-3">
									<Paperclip size={13} />
									<span>Reference image attached</span>
									<button
										type="button"
										onClick={() => setReference(undefined)}
										className="hover:text-white"
									>
										<X size={13} />
									</button>
								</div>
							)}

							<div className="composer-toolbar">
								<div className="composer-settings flex items-center gap-3">
									<label className="flex items-center gap-1.5 text-xs text-[#b8ac90] hover:text-[#ffe4a6] cursor-pointer bg-[#24160c] px-3 py-1.5 rounded-lg border border-[#3a2a1a]">
										<Paperclip size={13} />
										<span>Reference</span>
										<input
											type="file"
											accept="image/png,image/jpeg,image/webp"
											className="hidden"
											onChange={(e) => upload(e.target.files?.[0])}
										/>
									</label>

									{mode !== "text" && (
										<select
											className="bg-[#24160c] border border-[#3a2a1a] text-xs text-[#ffe4a6] rounded-lg px-2.5 py-1.5 outline-none"
											aria-label="Aspect ratio"
											value={aspectRatio}
											onChange={(e) => setAspectRatio(e.target.value)}
										>
											<option value="16:9">16:9 Landscape</option>
											<option value="9:16">9:16 Vertical</option>
											<option value="1:1">1:1 Square</option>
										</select>
									)}

									{mode === "video" && (
										<select
											className="bg-[#24160c] border border-[#3a2a1a] text-xs text-[#ffe4a6] rounded-lg px-2.5 py-1.5 outline-none"
											aria-label="Video duration"
											value={duration}
											onChange={(e) => setDuration(Number(e.target.value))}
										>
											<option value={6}>6 Seconds</option>
											<option value={10}>10 Seconds (2K)</option>
										</select>
									)}
								</div>

								<div className="composer-actions flex items-center gap-3">
									<span className="token-cost-badge">
										<Coins size={12} className="text-[#f54900]" />
										<span>Cost: {current.cost} tokens</span>
									</span>

									<button
										type="submit"
										disabled={busy || !prompt.trim()}
										className="run-btn"
									>
										{busy ? (
											"Processing..."
										) : (
											<>
												Generate <ArrowRight size={14} />
											</>
										)}
									</button>
								</div>
							</div>
						</form>

						<p className="text-xs text-[#b8ac90] p-4">
							Local preview: displayed operation rates are legacy rates, not a
							verified Vidorya tariff. Email verification and commercial
							checkout are pending integration.
						</p>
						{/* Prompt starters */}
						<div className="mb-10">
							<div className="text-xs font-bold uppercase tracking-wider text-[#8a7e6f] mb-3">
								Prompt Starters
							</div>
							<div className="starter-chips">
								{examples.map((item) => (
									<button
										key={item.title}
										className="starter-chip"
										onClick={() => {
											setPrompt(item.prompt);
										}}
									>
										{item.title}
									</button>
								))}
							</div>
						</div>

						{/* Generation history / results */}
						{runs.length > 0 && (
							<div className="mb-12">
								<h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
									<span>Creations in this Workspace</span>
									<span className="text-xs font-normal text-[#8a7e6f]">
										({runs.length})
									</span>
								</h2>

								<div className="flex flex-col gap-4">
									{runs.map((run) => (
										<div className="run-result-card" key={run.id}>
											<div className="flex items-center justify-between text-xs text-[#8a7e6f] mb-2 pb-2 border-b border-[#2a1c10]">
												<span className="font-semibold text-[#ffe4a6] uppercase tracking-wider">
													{run.mode} generation
												</span>
												<div className="flex items-center gap-3">
													{run.tokens_spent && (
														<span className="text-[#f3913e] font-bold">
															-{run.tokens_spent} tokens
														</span>
													)}
													<span
														className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
															run.status === "completed"
																? "bg-[#0f2e1a] text-[#33ec64]"
																: run.status === "pending"
																	? "bg-[#33220f] text-[#f99c00]"
																	: "bg-[#331118] text-[#ff3355]"
														}`}
													>
														{run.status}
													</span>
												</div>
											</div>

											<p className="text-sm font-medium text-white mb-4">
												{run.prompt}
											</p>

											{run.status === "pending" ? (
												<div className="p-4 rounded-lg bg-[#24160c] border border-[#3a2a1a] text-xs text-[#ffe4a6] flex items-center gap-3">
													<div className="w-4 h-4 rounded-full border-2 border-[#f54900] border-t-transparent animate-spin" />
													<span>
														Video rendering in progress on 2K cluster.
														Auto-refreshing...
													</span>
												</div>
											) : run.status === "failed" ? (
												<div className="text-sm text-[#ff6677]">
													{run.error || "Generation could not be completed."}
												</div>
											) : run.mode === "text" ? (
												<div className="text-sm text-[#d0c6b4] whitespace-pre-wrap leading-relaxed bg-[#120a05] p-4 rounded-xl border border-[#2a1c10]">
													{run.result}
												</div>
											) : run.result?.startsWith("https://") ||
												run.result?.startsWith("data:image/") ||
												run.result?.startsWith("/api/video-content") ? (
												run.mode === "image" ? (
													<img
														src={run.result}
														alt={run.prompt}
														className="rounded-xl border border-[#3a2a1a] max-h-[500px] w-auto object-contain"
													/>
												) : (
													<video
														src={run.result}
														controls
														className="rounded-xl border border-[#3a2a1a] max-h-[500px] w-full"
													/>
												)
											) : (
												<p className="text-xs text-[#8a7e6f]">Result ready.</p>
											)}
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</div>
			</section>

			{/* Token Top-up Modal */}
			{topupOpen && (
				<div
					className="modal-backdrop"
					onClick={(e) => {
						if (e.target === e.currentTarget) {
							setAuthOpen(false);
							setTopupOpen(false);
						}
					}}
				>
					<div
						role="dialog"
						aria-modal="true"
						aria-label="Token packages"
						tabIndex={-1}
						className="studio-dialog bg-[#1f140b] border border-[#3a2a1a] rounded-2xl max-w-lg w-full p-8 relative shadow-2xl"
					>
						<button
							className="absolute top-5 right-5 text-[#8a7e6f] hover:text-white"
							onClick={() => setTopupOpen(false)}
							aria-label="Close modal"
						>
							<X size={20} />
						</button>

						<div className="flex items-center gap-3 mb-4">
							<div className="w-10 h-10 rounded-xl bg-[#2a1c10] border border-[#3a2a1a] text-[#f54900] grid place-items-center">
								<Coins size={22} />
							</div>
							<div>
								<h3 className="text-xl font-bold text-white">
									Top Up Token Balance
								</h3>
								<p className="text-xs text-[#8a7e6f]">
									Current balance:{" "}
									<span className="text-[#ffe4a6] font-bold">
										{tokens.toLocaleString()} tokens
									</span>
								</p>
							</div>
						</div>

						{topupSuccess && (
							<div className="mb-4 p-3 rounded-lg bg-[#0f2e1a] border border-[#1f8a3b] text-sm text-[#33ec64] font-semibold">
								{topupSuccess}
							</div>
						)}

						<p className="text-sm text-[#b8ac90] mb-6 leading-relaxed">
							Tokens are valid for 12 months with no subscription lock-ins.
							Choose a package for secure Infini checkout, or order separately by invoice:
						</p>

						{orderMsg && (
							<div className="mb-4 p-3 rounded-lg bg-[#0f2e1a] border border-[#1f8a3b] text-sm text-[#33ec64] font-semibold">
								{orderMsg}
							</div>
						)}
						<div className="grid grid-cols-2 gap-3 mb-6">
							{Object.entries(TOKEN_PACKAGES).map(([id, p]) => (
								<button
									key={id}
                                    type="button"
                                    disabled={busy || !onlineEnabled}
                                    title={onlineEnabled ? "Continue to Infini" : "Online payments are not configured"}
									onClick={() => void checkout(id as keyof typeof TOKEN_PACKAGES)}
									className="bg-[#120a05] border border-[#3a2a1a] p-4 rounded-xl text-left hover:border-[#f54900] transition-colors disabled:opacity-60"
								>
									<div className="text-xs text-[#8a7e6f]">{p.label}</div>
									<div className="text-2xl font-black text-white mt-1">
										€{p.priceEur}
									</div>
									<div className="text-xs text-[#f3913e] mt-1">
										{p.tokens.toLocaleString("en-US")} tokens
									</div>
									<div className="text-xs mt-2 text-[#ffe4a6] font-bold">{onlineEnabled ? "Pay with Infini ↗" : "Online payment unavailable"}</div>
								</button>
							))}
						</div>

                        {!onlineEnabled && <p className="text-sm text-[#ffe4a6]">Online payments are not enabled. No charge has been made. Invoice orders remain available below.</p>}
                        <div className="mt-4 text-sm text-[#b8ac90]">
                          <p>Online payment orders</p>
                          {paymentOrders.length === 0 && <p className="text-xs">No online orders yet.</p>}
                          {paymentOrders.map(o => <div key={o.id} className="mt-2 rounded-lg border border-[#3a2a1a] p-3">
                            €{o.eur_amount} · {o.tokens.toLocaleString("en-US")} tokens · {o.status}
                            {o.status !== "credited" && <button type="button" disabled={busy || !onlineEnabled} className="block mt-2 underline" onClick={() => void refreshPayments(o.id)}>Check payment status</button>}
                            {o.status === "credited" && <button type="button" className="block mt-2 underline" onClick={() => {
                              for (const id of Object.keys(TOKEN_PACKAGES)) {
                                const key = `velora-checkout:${account?.id}:${id}`;
                                if (sessionStorage.getItem(key) === o.id) sessionStorage.removeItem(key);
                              }
                              setCheckoutRequest(null); setOrderMsg("You can now select a package for a new purchase.");
                            }}>Start a new purchase</button>}
                          </div>)}
                          {checkoutRequest && <p className="text-xs mt-2">Retrying the same package reuses order {checkoutRequest.requestId.slice(0,8)} to avoid duplicate charges.</p>}
                        </div>
						<div className="mt-6 rounded-xl border border-[#3a2a1a] bg-[#120a05] p-4">
							<div className="text-xs text-[#8a7e6f] font-bold uppercase">Custom amount (invoice order)</div>
							<div className="mt-2 flex items-baseline justify-between gap-3">
								<span className="text-2xl font-black text-white">€{customEur}</span>
								<span className="text-sm font-bold text-[#f3913e]">{(customEur * TOKENS_PER_EUR).toLocaleString("en-US")} tokens</span>
							</div>
							<label className="mt-3 block text-xs text-[#b8ac90]" htmlFor="studio-token-range">Choose an amount between €1 and €10,000</label>
							<input id="studio-token-range" type="range" min={1} max={200} step={1} value={Math.min(customEur, 200)} onChange={(e) => setCustomEur(Number(e.target.value))} className="mt-2 w-full" />
							<div className="mt-3 flex items-center gap-2">
								<label className="text-xs text-[#8a7e6f]" htmlFor="studio-token-eur">€</label>
								<input id="studio-token-eur" type="number" min={1} max={10000} step={1} value={customEur} onChange={(e) => setCustomEur(Math.max(1, Math.min(10000, Number(e.target.value) || 1)))} className="w-28 bg-[#24160c] border border-[#3a2a1a] text-xs text-[#ffe4a6] rounded-lg px-2.5 py-2 outline-none" />
								<button type="button" disabled={busy} onClick={() => void placeOrder(customEur)} className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#f3913e] to-[#f54900] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60">Place invoice order ↗</button>
							</div>
							<p className="mt-3 text-xs text-[#8a7e6f]">No online payment is taken here. After you place the order, {COMPANY.name} issues an invoice; tokens are credited by an administrator after payment.</p>
						</div>
						<div className="mt-6 rounded-xl border border-[#3a2a1a] bg-[#120a05] p-4">
							<div className="text-xs text-[#8a7e6f] font-bold uppercase">My invoice orders</div>
							{orders.length === 0 ? (
								<p className="mt-2 text-xs text-[#8a7e6f]">No orders yet. Place your first invoice order above.</p>
							) : (
								<ul className="mt-3 space-y-2">
									{orders.filter((o) => isAdmin || !o.email || true).slice(0, isAdmin ? 100 : 50).map((o) => (
										<li key={o.id} className="rounded-lg border border-[#2a1c10] bg-[#1f140b] p-3 text-xs text-[#d0c6b4]">
											<div className="flex items-center justify-between gap-2">
												<span className="font-bold text-white">€{o.eur_amount} = {o.tokens.toLocaleString("en-US")} tokens</span>
												<span className="rounded-full border border-[#3a2a1a] px-2 py-0.5 text-[10px] font-bold uppercase text-[#ffe4a6]">{o.status}</span>
											</div>
											<div className="mt-1 text-[11px] text-[#8a7e6f]">{new Date(o.created_at).toLocaleString()} · {o.id.slice(0, 8)}{o.email && isAdmin ? ` · ${o.email}` : ""}</div>
											{o.admin_note && <div className="mt-1 text-[11px] text-[#ffe4a6]">Admin: {o.admin_note}</div>}
											{isAdmin && o.status !== "credited" && o.status !== "cancelled" && (
												<div className="mt-2 flex flex-wrap items-center gap-2">
													<input value={adminBusyId === o.id ? "" : adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="Admin note (optional)" maxLength={2000} className="min-w-0 flex-1 bg-[#24160c] border border-[#3a2a1a] text-xs text-[#ffe4a6] rounded-lg px-2.5 py-2 outline-none" />
													<button type="button" disabled={adminBusyId === o.id} onClick={() => void decideOrder(o.id, "invoiced")} className="rounded-full border border-[#3a2a1a] px-3 py-1.5 text-[11px] font-bold text-[#ffe4a6] disabled:opacity-60">Invoiced</button>
													<button type="button" disabled={adminBusyId === o.id} onClick={() => void decideOrder(o.id, "credited")} className="rounded-full bg-[#0f2e1a] border border-[#1f8a3b] px-3 py-1.5 text-[11px] font-bold text-[#33ec64] disabled:opacity-60">Credit tokens</button>
													<button type="button" disabled={adminBusyId === o.id} onClick={() => void decideOrder(o.id, "cancelled")} className="rounded-full border border-[#e93e3a] px-3 py-1.5 text-[11px] font-bold text-[#ff9988] disabled:opacity-60">Cancel</button>
												</div>
											)}
										</li>
									))}
								</ul>
							)}
							{isAdmin && <p className="mt-3 text-[11px] text-[#8a7e6f]">Administrator view: recent orders across all users. Only emails in ADMIN_EMAILS can credit tokens.</p>}
						</div>
						<p className="text-xs text-[#b8ac90]">
							Infini handles online checkout; available methods depend on merchant approval. Tokens are credited only after server-side payment verification, not on return from checkout. Invoice orders remain separate. Token expiry enforcement, refunds and mandatory consumer disclosures must be completed before commercial launch. Tokens cannot be transferred or withdrawn.
						</p>
						<p className="text-xs text-[#b8ac90] mt-3">
							<Link href="/terms-and-conditions">Terms and Conditions</Link> ·{" "}
							<Link href="/privacy-policy">Privacy Policy</Link>
						</p>
					</div>
				</div>
			)}

			{/* Authentication Modal */}
			{authOpen && (
				<div
					className="modal-backdrop"
					onClick={(e) => {
						if (e.target === e.currentTarget) {
							setAuthOpen(false);
							setTopupOpen(false);
						}
					}}
				>
					<div
						role="dialog"
						aria-modal="true"
						aria-label="Account access"
						tabIndex={-1}
						className="studio-dialog bg-[#1f140b] border border-[#3a2a1a] rounded-2xl max-w-md w-full p-8 relative shadow-2xl"
					>
						<button
							className="absolute top-5 right-5 text-[#8a7e6f] hover:text-white"
							onClick={() => setAuthOpen(false)}
							aria-label="Close modal"
						>
							<X size={20} />
						</button>

						<VeloraLogo size={36} />

						<h3 className="text-2xl font-black text-white mt-4 mb-1">
							{authMode === "register" ? "Create your account" : "Welcome back"}
						</h3>
						<p className="text-xs text-[#b8ac90] mb-6">
							{authMode === "register"
								? "Create an account to access automated AI generation. No free signup tokens are issued."
								: "Sign in to access your token balance, workspaces, and history."}
						</p>

						{error && (
							<div className="mb-4 p-3 rounded-lg bg-[#2b0f0b] border border-[#e93e3a] text-xs text-[#ff9988]">
								{error}
							</div>
						)}

						{verifyNotice && (
							<div className="mb-4 p-3 rounded-lg bg-[#0f2e1a] border border-[#1f8a3b] text-xs text-[#7dffa8]">
								{verifyNotice}
							</div>
						)}

						<form onSubmit={authenticate} className="flex flex-col gap-4">
							<div>
								<label className="text-xs font-bold uppercase text-[#8a7e6f] block mb-1">
									Email Address
								</label>
								<input
									type="email"
									autoComplete="email"
									aria-label="Email address"
									autoFocus
									required
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="creator@example.com"
									className="w-full bg-[#120a05] border border-[#3a2a1a] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[#f54900]"
								/>
							</div>

							<div>
								<label className="text-xs font-bold uppercase text-[#8a7e6f] block mb-1">
									Password (min. 10 characters)
								</label>
								<input
									type="password"
									autoComplete={
										authMode === "register"
											? "new-password"
											: "current-password"
									}
									aria-label="Password"
									required
									minLength={10}
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="••••••••••••"
									className="w-full bg-[#120a05] border border-[#3a2a1a] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[#f54900]"
								/>
							</div>

							<button
								type="submit"
								disabled={busy}
								className="mt-2 w-full header-action-btn justify-center py-3 text-sm font-bold"
							>
								{busy
									? "Please wait..."
									: authMode === "register"
										? "Create Account"
										: "Sign In"}
							</button>
						</form>

						<div className="mt-4 text-center text-xs text-[#8a7e6f]">
							Didn\u2019t get the confirmation email?{" "}
							<button
								type="button"
								disabled={resendBusy || !email}
								className="text-[#ffe4a6] font-bold hover:underline disabled:opacity-60"
								onClick={() => void resendVerification()}
							>
								{resendBusy ? "Sending\u2026" : "Resend confirmation link"}
							</button>
						</div>

						<div className="mt-4 text-center text-xs text-[#8a7e6f]">
							{authMode === "register" ? (
								<>
									Already have an account?{" "}
									<button
											className="text-[#ffe4a6] font-bold hover:underline"
											onClick={() => {
												setAuthMode("login");
												setError("");
												setVerifyNotice("");
											}}
										>
											Sign in
										</button>
									</>
								) : (
									<>
										Need an account?{" "}
										<button
											className="text-[#ffe4a6] font-bold hover:underline"
											onClick={() => {
												setAuthMode("register");
												setError("");
												setVerifyNotice("");
											}}
										>
											Register
										</button>
									</>
								)}
						</div>
					</div>
				</div>
			)}
		</main>
	);
}
