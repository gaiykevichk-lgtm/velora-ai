"use client";
import { useState, useEffect } from "react";
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
				<p>Questions about the platform? Contact ORIA SASU.</p>
				<a href="mailto:contact@oria.com.im">contact@oria.com.im ↗</a>
			</div>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					const data = new FormData(e.currentTarget);
					const body = `Name: ${data.get("name")}\nPhone: ${data.get("phone")}\nEmail: ${data.get("email")}\n\n${data.get("comment")}`;
					window.location.href = `mailto:contact@oria.com.im?subject=${encodeURIComponent("Velora AI enquiry")}&body=${encodeURIComponent(body)}`;
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
