"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function ResetForm() {
	const token = useSearchParams().get("token") ?? "";
	const [password, setPassword] = useState("");
	const [state, setState] = useState<"idle" | "busy" | "done">("idle");
	const [error, setError] = useState("");
	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setState("busy");
		setError("");
		try {
			const r = await fetch("/api/auth/password", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token, password }),
			});
			const body = await r.json();
			if (!r.ok) throw new Error(body.error || "Something went wrong.");
			setState("done");
		} catch (err) {
			setError((err as Error).message);
			setState("idle");
		}
	}
	return (
		<main style={{ maxWidth: 420, margin: "80px auto", padding: 24, color: "#fff" }}>
			<h1 style={{ fontSize: 24, fontWeight: 800 }}>Set a new password</h1>
			{state === "done" ? (
				<p style={{ marginTop: 16 }}>
					Your password was changed. <a href="/studio?auth=login" style={{ textDecoration: "underline" }}>Sign in</a>
				</p>
			) : !token ? (
				<p style={{ marginTop: 16 }}>This link is incomplete. Request a new one from the sign-in form.</p>
			) : (
				<form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
					<label htmlFor="np">New password (min. 10 characters)</label>
					<input id="np" type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: 10, borderRadius: 8, color: "#000" }} />
					{error && <p role="alert" style={{ color: "#ff9988" }}>{error}</p>}
					<button type="submit" disabled={state === "busy"} style={{ padding: 12, borderRadius: 8, fontWeight: 700 }}>
						{state === "busy" ? "Please wait…" : "Change password"}
					</button>
				</form>
			)}
		</main>
	);
}
export default function ResetPasswordPage() {
	return (
		<Suspense fallback={null}>
			<ResetForm />
		</Suspense>
	);
}
