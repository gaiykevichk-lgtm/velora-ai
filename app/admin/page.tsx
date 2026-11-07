import { redirect } from "next/navigation";
import { adminUser } from "@/lib/admin";
import { AdminApp } from "./admin-app";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin — Velora AI" };

export default async function AdminPage() {
	const admin = await adminUser();
	if (!admin) redirect("/studio");
	return <AdminApp email={admin.email} />;
}
