import Link from "next/link";
import { VeloraLogo } from "./logo";
import {
	ContactForm,
	CookiePreferences,
	TokenEstimator,
} from "./public-controls";
import { COMPANY } from "@/lib/company";
import { TOKEN_PACKAGES } from "@/lib/commerce";

export const navigation = [
	["Home", "/"],
	["Services", "/services"],
	["Pricing", "/pricing"],
	["About Us", "/about"],
	["Contacts", "/contacts"],
	["FAQ", "/faq"],
];

export const serviceCategories = [
	[
		"AI Video Generation",
		"Describe your idea, choose the available settings, and generate video automatically. Each video costs 100 tokens.",
		"Available",
	],
	[
		"AI Image Generation",
		"Generate an image from a prompt, optionally using one of your own images as a reference. Each image costs 25 tokens.",
		"Available",
	],
	[
		"AI Story & Script Generation",
		"Develop structured narratives, scripts and prompts in the text studio. Each request costs 5 tokens.",
		"Available",
	],
	[
		"AI Music Generation",
		"Music generation for creative projects.",
		"Not offered in this version.",
	],
	[
		"AI Voice & Narration",
		"AI-generated voice and narration.",
		"Not offered in this version.",
	],
	[
		"AI Video Editing & Enhancement",
		"AI processing and enhancement of existing footage.",
		"Not offered in this version.",
	],
];

export const faq = [
	[
		"How does Velora AI token-based pricing work?",
		"Buy prepaid tokens and spend them only on generation you start. The cost is shown before every run: 5 tokens for a text request, 25 for an image, 100 for a video. You can top up by card through Infini checkout or by bank transfer.",
	],
	[
		"Do I need a subscription?",
		"No. There is no monthly subscription or recurring plan. Tokens are bought once and used at your own pace.",
	],
	[
		"How much can I buy at once?",
		"The fixed packages are €20 (2,000 tokens) and €100 (10,000 tokens). A bank transfer order can be any whole euro amount from €2 to €2,500, and every €1 gives 100 tokens.",
	],
	[
		"How fast are tokens credited?",
		"Card payments are credited automatically once Infini confirms the payment on the server. Bank transfers are credited after Omnix21 confirms the money has arrived — within 2 business days of receipt.",
	],
	[
		"Do tokens expire?",
		"Yes. Tokens are valid for 12 months from the date they are credited, and the expiry date is fixed per purchase. Your account shows the balance that is still usable, and expired tokens are removed automatically.",
	],
	[
		"Can I get a refund for unused tokens?",
		"Yes, under the conditions below. Within 14 days of the credit you can cancel the purchase and get the unused tokens refunded to the account you paid from. After those 14 days unused tokens stay valid until their own expiry date instead of being refunded, and used tokens are not refunded. Mandatory French and EU consumer rights, including remedies for non-conforming digital content, always apply.",
	],
	[
		"Are tokens transferable between accounts?",
		"No. Tokens are for use inside Velora AI only. They cannot be transferred, sold, exchanged for money or withdrawn. Statutory refunds are not excluded.",
	],
	[
		"Why do I need to confirm my email?",
		"Registration sends a confirmation link that is valid for 24 hours. Generation and purchases require a confirmed address, so the account, its balance and its invoices always belong to a reachable owner.",
	],
];

const terms = [
	[
		"1. Operator and scope",
		`Velora AI at veloraai.pro is operated by ${COMPANY.name}, registered in France under number ${COMPANY.registration}, with registered address at ${COMPANY.address}. Phone: ${COMPANY.phone}. Email: ${COMPANY.email}. These terms govern the self-service platform: automated AI generation, not commissioned production, manual editing or creative review. Orders are concluded in English; support is available at the contacts above.`,
	],
	[
		"2. Account and email verification",
		"Provide accurate account information and keep your password confidential. Registration sends a confirmation link that stays valid for 24 hours; generation and purchases are available only after the address is confirmed. You are responsible for activity performed from your account. Report unauthorised access to us immediately.",
	],
	[
		"3. Automated services and limitations",
		"You choose prompts and the settings offered in the studio. AI output may contain inaccuracies, artefacts and third-party rights issues, so check the result before using it. We do not guarantee that output is unique, error-free or legally protected. Availability of each service is stated on the Services page; services marked as not offered are not sold.",
	],
	[
		"4. Prepaid tokens and prices",
		`Tokens are prepaid platform usage units. The fixed packages are €20 for 2,000 tokens and €100 for 10,000 tokens, and every €1 paid gives 100 tokens. A bank transfer order can be any whole euro amount between €2 and €2,500. There is no subscription and no recurring charge. Tokens are not money, are not a payment instrument, and cannot be transferred, exchanged for cash or withdrawn. They are valid for 12 months from the date they are credited; the expiry date is recorded per purchase, shown in your account, and expired tokens are removed from the usable balance automatically.`,
	],
	[
		"5. Operation costs",
		"Each generation is charged in tokens at the rate displayed before you start: 5 tokens per text request, 25 tokens per image and 100 tokens per video. The cost is shown next to the Generate button and is deducted once per completed request. We may change operation rates for future runs, but a change never alters the number of tokens already credited to you.",
	],
	[
		"6. Payment, invoicing and delivery",
		"Two payment methods are available in your account. Card checkout is processed by Infini: tokens are credited automatically only after the payment is verified server-side, never on the basis of returning from the checkout page. Bank transfer orders are issued as a numbered invoice with the seller's IBAN, BIC and an individual payment reference; tokens are credited once Omnix21 confirms the receipt, within 2 business days after the money arrives. The invoice and the payment receipt are available from the order in your account.",
	],
	[
		"7. Withdrawal, refunds and conformity",
		"You may cancel a token purchase within 14 days of the credit date and receive a refund of the unused tokens to the account you paid from; write to us from the account email and the refund is executed within 14 days of the request. After that period, unused tokens remain usable until their expiry date and are not refunded in cash; tokens already spent on generations are not refunded. Nothing here limits mandatory French or EU consumer rights, including statutory remedies for non-conforming digital content or services, or your right to withdraw where applicable law does not allow a waiver.",
	],
	[
		"8. Lawful use and intellectual property",
		"Submit only materials you may lawfully use. Do not use the platform for unlawful, infringing or harmful activity or to bypass safeguards. You keep your existing rights in the inputs you provide. Rights in generated output depend on applicable law and on the terms of the model providers; exclusive ownership or unlimited commercial rights are not guaranteed. Do not present generated output as human-made where disclosure is legally required.",
	],
	[
		"9. Data and third parties",
		"Account, prompt and generation data are processed to provide the platform, as described in the Privacy Policy. Generation requests are transmitted to the AI model providers configured for the platform. Files you upload as references are used only to process your request.",
	],
	[
		"10. Suspension and liability",
		"Access may be restricted where necessary for security, lawful operation, unpaid orders or serious misuse. We are liable for damage caused intentionally or by gross negligence and in all cases where liability cannot be limited by law; liability for slight negligence is limited to the foreseeable damage typical for this type of contract. Nothing in these terms excludes mandatory consumer remedies or statutory rights.",
	],
	[
		"11. Governing law, complaints and mediation",
		"French law applies, without depriving consumers of the mandatory protections of their country of habitual residence where applicable. Send complaints to " +
			`${COMPANY.email} or ${COMPANY.phone} (Monday–Friday, 09:00–18:00 Paris time); we answer within one month. If a complaint is not resolved, a consumer may use the mediation route proposed by the operator or any competent authority, and remains free to bring the matter before a court. Operator: ${COMPANY.name}, ${COMPANY.registration}, ${COMPANY.address}.`,
	],
];

const privacy = [
	[
		"1. Controller",
		`The data controller is ${COMPANY.name}, registration number ${COMPANY.registration}, registered address ${COMPANY.address}, France. Contact for any privacy request: ${COMPANY.email}. ${COMPANY.name} operates Velora AI at veloraai.pro.`,
	],
	[
		"2. Data we process",
		"Account email address, password hash, session records, email confirmation records, workspaces, prompts, generation settings, generation results and status, uploaded reference images you choose to send, token balances, purchase records, invoices and payment receipts. Payment card data is entered on the payment provider's checkout page and is never stored by us.",
	],
	[
		"3. Purposes and legal bases",
		"Account creation and generation are processed to perform the contract with you. Security, fraud prevention and abuse protection rely on our legitimate interest in operating the service safely. Invoices, payment records and accounting rely on legal obligations. Optional communication relies on your consent, which you can withdraw at any time.",
	],
	[
		"4. Processors and recipients",
		"Hosting and database: Render. Transactional email: Resend. Card payments: Infini. AI generation: the model providers configured for the platform (currently Google Gemini for text, Qwen for images and Minimax for video). Each provider receives only the prompt, settings and reference material needed for the requested generation. Our staff access order data only to confirm transfers, issue refunds and answer support requests.",
	],
	[
		"5. International transfers",
		"Some providers process data outside the European Economic Area. Such transfers rely on an applicable adequacy decision or on the European Commission's standard contractual clauses, together with the technical measures offered by the provider.",
	],
	[
		"6. Cookies",
		"One essential cookie, velora_session, keeps you signed in for up to 30 days; it is HttpOnly and SameSite=Lax. The cookie-preferences control stores your choice locally in your browser. No analytics or marketing cookies are set, so no consent banner is required for optional categories.",
	],
	[
		"7. Retention and security",
		"Account data is kept while your account is active; purchase and invoice records are kept for the accounting period required by French law. Deletion requests are handled within one month through " +
			`${COMPANY.email}. Passwords are stored as salted scrypt hashes, session tokens as SHA-256 hashes, and connections are encrypted in transit. No system is absolutely secure, so choose a strong unique password.`,
	],
	[
		"8. Your rights",
		"You have the right to access, rectify, erase, restrict and object to the processing of your data, and to receive your data in a portable format. You may withdraw consent at any time without affecting prior processing. Requests are answered within one month, subject to lawful extension. You may also lodge a complaint with CNIL (3 place de Fontenoy, 75007 Paris) or with the supervisory authority of your country of residence.",
	],
];

export type SitePage =
	| "about"
	| "services"
	| "pricing"
	| "contacts"
	| "faq"
	| "terms-and-conditions"
	| "privacy-policy";
type Page = { title: string; lead: string; blocks: string[][] };
export const pages: Record<SitePage, Page> = {
	about: {
		title: "About Velora AI",
		lead: `An automated AI creation platform operated by ${COMPANY.name}, France (${COMPANY.registration}).`,
		blocks: [
			[
				"From idea to output",
				"Describe your idea, adjust the available settings and receive an automatically generated result in your account. Text, image and video generation are available today; other categories are labelled as not offered until they are released.",
			],
			[
				"A self-serve workflow",
				"No manual creative production or human refinement is included. Generation runs on the model providers configured for the platform, and the price of each run is shown before you start it.",
			],
			[
				"Prepaid usage",
				"Tokens are bought in advance — €20 for 2,000, €100 for 10,000, or any bank transfer amount from €2 to €2,500 — and remain valid for 12 months from the credit date. There is no subscription.",
			],
		],
	},
	services: {
		title: "AI creation services",
		lead: "What you can generate today, and what is not offered yet.",
		blocks: serviceCategories,
	},
	pricing: {
		title: "Unlock AI video creation",
		lead: "Prepaid tokens. No monthly subscription. Choose a package or a bank transfer amount, top up your account and spend tokens on generation.",
		blocks: [
			[
				"Usage model",
				"The cost is fixed per run and shown before you confirm: 5 tokens for a text request, 25 for an image, 100 for a video. Tokens are deducted once for each completed request.",
			],
			[
				"Token validity",
				"Tokens are valid for 12 months from the credit date. Each purchase keeps its own expiry date, the account shows the balance that is still usable, and expired tokens are removed automatically.",
			],
			[
				"Deposit and refunds",
				"Card payments are credited as soon as Infini verifies them; bank transfers are credited within 2 business days after receipt. Unused tokens can be refunded to the paying account within 14 days of the credit; after that they stay usable until their expiry date. Mandatory consumer rights always apply.",
			],
			[
				"Platform-only tokens",
				"Tokens cannot be transferred, traded, exchanged for money or withdrawn.",
			],
		],
	},
	contacts: {
		title: "Contact us",
		lead: "Questions about Velora AI, your account or a payment? Contact Omnix21.",
		blocks: [
			["E-mail", COMPANY.email],
			[
				"Phone",
				"+33 6 87 35 58 25 — support hours Monday–Friday, 09:00–18:00 (Paris time)",
			],
			["Registered address", COMPANY.address],
			["Company", `${COMPANY.name} — ${COMPANY.registration}`],
		],
	},
	faq: {
		title: "Quick answers",
		lead: "Account, generation and prepaid token questions.",
		blocks: faq,
	},
	"terms-and-conditions": {
		title: "Terms and Conditions",
		lead: `Terms of sale and use of Velora AI, operated by ${COMPANY.name} (${COMPANY.registration}), France. Version 2026-10-26.`,
		blocks: terms,
	},
	"privacy-policy": {
		title: "Privacy Policy",
		lead: "How Omnix21 processes personal data on Velora AI, under the GDPR and French data-protection law. Version 2026-10-26.",
		blocks: privacy,
	},
};

export function SiteHeader() {
	return (
		<header className="v-header">
			<Link href="/" aria-label="Velora AI Home">
				<VeloraLogo size={36} />
			</Link>
			<nav aria-label="Main navigation">
				{navigation.map(([name, path]) => (
					<Link key={path} href={path}>
						{name}
					</Link>
				))}
			</nav>
			<Link className="v-outline" href="/studio?mode=video&auth=open">
				Log in ↗
			</Link>
		</header>
	);
}
export function SiteFooter() {
	return (
		<footer className="v-footer">
			<div className="v-footer-grid">
				<div>
					<VeloraLogo />
					<p>
						Automated AI video & image generation.
						<br />
						Prepaid tokens. No monthly subscription.
					</p>
					<a href="https://veloraai.pro">veloraai.pro</a>
				</div>
				<div>
					<h3>Platform</h3>
					{navigation.map(([name, path]) => (
						<Link key={path} href={path}>
							{name}
						</Link>
					))}
				</div>
				<div>
					<h3>Legal & Compliance</h3>
					<Link href="/terms-and-conditions">Terms and Conditions</Link>
					<Link href="/privacy-policy">Privacy Policy</Link>
					<h3>Payments & Security</h3>
					<p>
						Card checkout via Infini and bank transfer (€2–€2,500). Tokens are
						credited after the payment is verified. Unused tokens can be
						refunded within 14 days of the credit.
					</p>
				</div>
				<div>
					<h3>Contacts</h3>
					<p>Registered Address: {COMPANY.address}</p>
					<a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
					<a href={COMPANY.phoneHref}>{COMPANY.phone}</a>
					<p>Support Hours: {COMPANY.supportHours}</p>
					<p>
						{COMPANY.name} — {COMPANY.registration}
					</p>
				</div>
			</div>
			<div className="v-footer-bottom">
				<span>
					© {new Date().getFullYear()} Velora AI. All rights reserved.
				</span>
				<CookiePreferences />
			</div>
		</footer>
	);
}
export function FaqSection() {
	return (
		<section className="v-section" id="faq">
			<span className="v-eyebrow">FAQ</span>
			<h2>Quick answers</h2>
			<div className="v-faq">
				{faq.map(([q, a]) => (
					<details key={q}>
						<summary>
							{q}
							<span>+</span>
						</summary>
						<p>{a}</p>
					</details>
				))}
			</div>
		</section>
	);
}
export function PricingPackages() {
	return (
		<div className="v-packages">
			{Object.entries(TOKEN_PACKAGES).map(([id, p]) => (
				<article className="v-card" key={id}>
					<span className="v-eyebrow">{p.label}</span>
					<h2>€{p.priceEur}</h2>
					<h3>{p.tokens.toLocaleString("en-US")} tokens</h3>
					<p>One-time purchase · no subscription · tokens valid 12 months</p>
					<Link className="v-button" href="/studio?mode=video&topup=open">
						Buy in account ↗
					</Link>
				</article>
			))}
			<p className="v-small">
				Pay by card through Infini checkout or by bank transfer — a transfer can
				be any whole euro amount from €2 to €2,500. Card payments are credited
				once the payment is verified; bank transfers are credited within 2
				business days after receipt. Tokens are valid for 12 months from the
				credit date.
			</p>
		</div>
	);
}
export function ContentPage({ page }: { page: SitePage }) {
	const d = pages[page];
	return (
		<div className="v-site">
			<SiteHeader />
			<main>
				<section className="v-section v-page-heading">
					<span className="v-eyebrow">Home / {d.title}</span>
					<h1>{d.title}</h1>
					<p>{d.lead}</p>
				</section>
				{page === "pricing" && (
					<section className="v-section">
						<PricingPackages />
					</section>
				)}
				{page === "pricing" && <TokenEstimator />}
				{page === "faq" ? (
					<FaqSection />
				) : (
					<section className="v-section v-content-list">
						{d.blocks.map(([title, body, status]) => (
							<article className="v-card" key={title}>
								<h2>{title}</h2>
								<p>{body}</p>
								{status && <p className="v-status">{status}</p>}
							</article>
						))}
					</section>
				)}
				{["contacts", "pricing"].includes(page) && <ContactForm />}
			</main>
			<SiteFooter />
		</div>
	);
}
