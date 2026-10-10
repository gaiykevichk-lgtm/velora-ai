import { Suspense } from "react";
import { Workspace } from "../workspace";

export default function StudioPage() {
	return (
		<Suspense fallback={<div style={{ padding: 40 }}>Loading studio…</div>}>
			<Workspace />
		</Suspense>
	);
}
