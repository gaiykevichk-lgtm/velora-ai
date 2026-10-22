"use client";
import { useState, useEffect, useMemo } from "react";
import { COMPANY, TOKENS_PER_EUR } from "@/lib/company";
export function CookiePreferences() {
	const [open, setOpen] = useState(false);
	useEffect(() => {
		setOpen(!localStorage.getItem("velora-cookie-preferences"));
	}, []);
	function save() {
		localStorage.setItem(
			"velora-cookie-preferences",
			JSON.stringify({
				necessary: true,
				optional: false,
				updatedAt: new Date().toISOString(),
			}),
		);
		setOpen(false);
	}
	return (
		<>
			<button className="v-text-button" onClick={() => setOpen(true)}>
				Cookie preferences
			</button>
			{open && (
				<section className="v-cookie" aria-label="Cookies and privacy">
					<h2>Cookies & Privacy</h2>
					<p>
						Essential cookies keep your account secure. No optional analytics or
						marketing cookies are currently enabled.
					</p>
					<p>Strictly necessary: always active</p>
					<div>
						<button className="v-button" onClick={save}>
							Save my settings
						</button>
						<button className="v-outline" onClick={save}>
							Decline optional cookies
						</button>
					</div>
				</section>
			)}
		</>
	);
}
export function TokenEstimator() {
	const [eur, setEur] = useState(20);
	const tokens = useMemo(() => eur * TOKENS_PER_EUR, [eur]);
	return (
		<section
			className="v-section v-estimator"
			aria-label="Token cost estimator"
		>
			<span className="v-eyebrow">TOKEN ESTIMATOR</span>
			<h2>
				Preview your <span>token amount</span>
			</h2>
			<p className="v-intro">
				Select an amount to see how many tokens it corresponds to, then place an
				invoice order from your account. No online payment is taken here.
			</p>
			<div className="v-estimator-card">
				<div className="v-estimator-values">
					<div>
						<div className="v-eyebrow">AMOUNT</div>
						<div className="v-estimator-amount">€{eur}</div>
					</div>
					<div>
						<div className="v-eyebrow">TOKENS</div>
						<div className="v-estimator-amount">
							{tokens.toLocaleString("en-US")}
						</div>
					</div>
				</div>
				<label htmlFor="token-estimator-range">
					Choose an amount between €1 and €10,000
				</label>
				<input
					id="token-estimator-range"
					type="range"
					min={1}
					max={10000}
					step={1}
					value={eur}
					onChange={(e) => setEur(Number(e.target.value))}
				/>
				<p className="v-small">
					Rate: {TOKENS_PER_EUR} tokens per €1 — the same conversion as the
					agreed packages (€20 = 2,000 tokens, €100 = 10,000 tokens). To buy
					tokens, sign in and place an invoice order: {COMPANY.name} issues the
					invoice and an administrator credits the tokens after payment. Online
					card checkout is not connected.
				</p>
				<a className="v-button" href="/studio?mode=video&topup=open">
					Order {tokens.toLocaleString("en-US")} tokens by invoice ↗
				</a>
			</div>
		</section>
	);
}
export function ContactForm() {
	const [status, setStatus] = useState("");
	return (
		<section className="v-section v-contact" id="contact">
			<div>
				<span className="v-eyebrow">CONTACTS</span>
				<h2>
					Start your
					<br />
					<span>Project</span>
				</h2>
				<p>Questions about the platform? Contact Omnix21.</p>
				<a href={`mailto:${COMPANY.email}`}>{COMPANY.email} ↗</a>
			</div>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					const data = new FormData(e.currentTarget);
					const body = `Name: ${data.get("name")}\nPhone: ${data.get("phone")}\nEmail: ${data.get("email")}\n\n${data.get("comment")}`;
					window.location.href = `mailto:${COMPANY.email}?subject=${encodeURIComponent("Velora AI enquiry")}&body=${encodeURIComponent(body)}`;
					setStatus(
						"Your email application has been opened. The message has not been sent by this website.",
					);
				}}
			>
				<label>
					Your name
					<input name="name" autoComplete="name" required maxLength={120} />
				</label>
				<label>
					Phone
					<input name="phone" type="tel" autoComplete="tel" maxLength={40} />
				</label>
				<label>
					Your e-mail
					<input
						name="email"
						type="email"
						autoComplete="email"
						required
						maxLength={254}
					/>
				</label>
				<label>
					Your comment
					<textarea name="comment" required maxLength={4000} rows={4} />
				</label>
				<p className="v-small">
					This form opens your email app; direct website delivery is not
					connected yet. See our <a href="/privacy-policy">Privacy Policy</a>.
				</p>
				<button className="v-button" type="submit">
					Send ↗
				</button>
				<p role="status">{status}</p>
			</form>
		</section>
	);
}
