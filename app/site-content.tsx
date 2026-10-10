import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { VeloraLogo } from "./logo";

export type SitePage =
	| "about"
	| "guide"
	| "faq"
	| "availability"
	| "privacy"
	| "terms"
	| "pricing"
	| "services";

export const pages: Record<
	SitePage,
	{
		eyebrow: string;
		title: string;
		lead: string;
		blocks: { title: string; body: string }[];
		note: string;
		cta: string;
	}
> = {
	about: {
		eyebrow: "ABOUT VELORA",
		title: "AI Video & Image Generation Platform with Human Refinement",
		lead: "velora combines AI automation, creative talent, and secure infrastructure to deliver professional video and image generation at scale.",
		blocks: [
			{
				title: "From Idea to Video Instantly",
				body: "Describe your concept in plain words, and our engine transforms it into polished visuals. No complex editing suites or multi-week production pipelines.",
			},
			{
				title: "Integrated Human-Assisted Refinement",
				body: "Unlike fully automated black-box tools, velora pairs high-speed neural network generations with human-in-the-loop polish for brand-consistent deliverables.",
			},
			{
				title: "Enterprise Security & Infrastructure",
				body: "All transactions and assets are handled via regulated payment partners and enterprise GPU clusters, giving creator teams auditability and compliance.",
			},
		],
		note: "Start creating without subscriptions. Only pay for the tokens you use.",
		cta: "Launch Studio",
	},
	guide: {
		eyebrow: "FIELD GUIDE",
		title: "How Generation Works on Velora",
		lead: "Three core creative surfaces powered by state-of-the-art models and simple token deductions.",
		blocks: [
			{
				title: "1. Smart Prompt Control (Text Studio)",
				body: "Powered by Gemini 3.8 Flash. Craft story treatments, script outlines, prompt directions, and brand copy. Costs 5 tokens per run.",
			},
			{
				title: "2. Visual Styling & Composition (Image Studio)",
				body: "Powered by Qwen Image 3 Pro. Generate photorealistic or stylized keyframes from text or reference images. Costs 25 tokens per image.",
			},
			{
				title: "3. Rapid Motion Rendering (Video Studio)",
				body: "Powered by Hailuo 3 (MiniMax). Produce high-fidelity 2K video clips up to 10 seconds with physics-consistent camera motion. Costs 100 tokens per clip.",
			},
		],
		note: "Every prompt can be starter-assisted or written freely.",
		cta: "Open the Studio",
	},
	faq: {
		eyebrow: "FAQ & HELP CENTER",
		title: "Quick Answers to Common Questions",
		lead: "Clear rules on token billing, usage rights, and account features.",
		blocks: [
			{
				title: "How does the token-based pricing work?",
				body: "velora uses a pay-as-you-create token system. You purchase a token package or start with free signup credits. Tokens are deducted only when you generate text, images, or video.",
			},
			{
				title: "Do I need a monthly subscription?",
				body: "No. There are no recurring monthly charges or subscription lock-ins. Top up your token balance whenever you need to create.",
			},
			{
				title: "Do tokens expire?",
				body: "Tokens remain valid for 12 months from the date of credit. Unused tokens roll over as long as the account remains active.",
			},
			{
				title: "What are the token costs per generation?",
				body: "Text chat & scriptwriting: 5 tokens. Image generation & refinement: 25 tokens. 2K Video generation: 100 tokens.",
			},
		],
		note: "Have more questions? Our support team is available at contact@oria.com.im",
		cta: "Try Studio Now",
	},
	pricing: {
		eyebrow: "PRICING OVERVIEW",
		title: "Pay Only for What You Create",
		lead: "No recurring subscriptions. Top up in fiat, get tokens, and use them whenever inspiration strikes.",
		blocks: [
			{
				title: "Starter Package — $10 (1,000 Tokens)",
				body: "Best for quick experiments and creative tests. Enough for 200 text queries, 40 images, or 10 high-resolution video renders.",
			},
			{
				title: "Creator Package — $20 (2,500 Tokens)",
				body: "Our most popular package for active content creators. Enables dozens of campaign variations, thumbnails, and short reels.",
			},
			{
				title: "Pro Studio — $50 (7,000 Tokens)",
				body: "Engineered for marketing teams and agencies delivering client visuals and narrative video campaigns on tight deadlines.",
			},
			{
				title: "Scale Agency — $100 (15,000 Tokens)",
				body: "Maximum value per token for heavy video workflows, multi-scene storyboarding, and enterprise content pipelines.",
			},
		],
		note: "Every new verified account receives 500 complimentary welcome tokens to test all three studios.",
		cta: "Top Up in Studio",
	},
	services: {
		eyebrow: "OUR SERVICES",
		title: "High-Volume Visual & Motion Services",
		lead: "Full-spectrum AI creation tools designed for modern creators, e-commerce brands, and marketing agencies.",
		blocks: [
			{
				title: "AI Video Generation",
				body: "Create broadcast-grade 2K videos in minutes for ads, social media, presentations, and product showcases without filming crews.",
			},
			{
				title: "Multi-Modal Visual Assets",
				body: "Produce lifestyle photography, hero banners, and 3D-styled illustrations aligned with your brand guidelines.",
			},
			{
				title: "Custom Creative Workflows",
				body: "API endpoints and dedicated rendering capacity for high-volume automated asset generation.",
			},
		],
		note: "Need a managed custom production? Contact our solutions team.",
		cta: "Start with AI Studio",
	},
	availability: {
		eyebrow: "SYSTEM AVAILABILITY",
		title: "Operational Status & Integrations",
		lead: "Real-time overview of active neural engines, databases, and generation pipelines.",
		blocks: [
			{
				title: "Active Text Engine",
				body: "Google Gemini 3.8 Flash via Promto API Gateway. Status: Online & operational.",
			},
			{
				title: "Active Image Engine",
				body: "Qwen Image 3 Pro via Promto Image API. Status: Online & operational.",
			},
			{
				title: "Active Video Engine",
				body: "MiniMax Hailuo 3 async video generation pipeline with authenticated media proxy. Status: Online & operational.",
			},
		],
		note: "All generations operate through secure sandbox microservices.",
		cta: "Enter Studio",
	},
	privacy: {
		eyebrow: "DATA & PRIVACY",
		title: "Privacy Policy",
		lead: "This Privacy Policy explains how ORIA collects, processes, and protects the personal information of individuals who access or use our AI-powered video and image generation platform.",
		blocks: [
			{
				title: "01. General Provisions & Legal Entity",
				body: "ORIA (Company number: 108 261 926, Registered Address: 47 rue Vivienne, 75002 Paris, France) is the data controller responsible for processing personal data collected through this platform. The Company ensures all data is processed in accordance with the EU General Data Protection Regulation (Regulation (EU) 2016/679 - EU GDPR) and applicable national data protection legislation. For inquiries, contact us at contact@oria.com.im or by phone at +34637558778 (Support hours: 10:00 AM – 6:00 PM CET).",
			},
			{
				title: "02. Data We Collect",
				body: "We collect information necessary to operate the platform and provide AI generation services, including your name, email address, phone number, and account credentials. Technical data such as IP address, browser type, device information, and activity logs are collected automatically. Payment transactions are processed exclusively by licensed third-party payment service providers complying with financial regulations; we do not store full payment card numbers.",
			},
			{
				title: "03. How We Use Your Information",
				body: "We use your data to operate and improve our platform, manage user accounts, deliver AI video and image generations, process transactions, provide customer support, and fulfill statutory legal obligations. ORIA acts as the Data Controller for user account, billing, and communication data.",
			},
			{
				title: "04. User Content & AI Training Guarantee",
				body: "Content created, uploaded, or generated by users is processed solely to deliver the requested AI generation. We do not use user-generated content, creative prompts, or personal data to train, retrain, or improve public AI models. For content uploaded into prompts, ORIA acts strictly as a Data Processor operating under user instructions.",
			},
			{
				title: "05. Cookies & Tracking Technologies",
				body: "We use strictly necessary cookies to ensure security, authentication, and core functionality. Optional performance, analytics, and functional cookies are used only with your consent and can be adjusted anytime via browser or platform settings.",
			},
			{
				title: "06. Legal Basis for Processing",
				body: "We process personal data under lawful bases recognized by the EU GDPR: Performance of Contract (account management and service delivery), Compliance with Legal Obligations (tax, accounting, and anti-fraud duties), Legitimate Interests (platform security and stability), and Consent (where explicitly granted).",
			},
			{
				title: "07. International Data Transfers",
				body: "Where service providers (such as cloud GPU clusters or identity verification partners) operate outside the European Economic Area (EEA), we ensure adequate protection through European Commission Standard Contractual Clauses (SCCs) and equivalent recognized safeguards.",
			},
			{
				title: "08. Data Security & Storage Period",
				body: "All transmissions are encrypted with modern cryptographic protocols, and access is strictly restricted. We retain account and transactional records for up to 6 years in accordance with applicable statutory and tax laws, after which data is securely deleted or anonymized.",
			},
			{
				title: "09. Your Privacy Rights",
				body: "Under the EU GDPR, you have the right to access, rectify, or erase your personal data ('Right to be Forgotten'), restrict or object to processing, data portability, and withdrawal of consent. To exercise your rights, email contact@oria.com.im. You also have the right to lodge a complaint with your supervisory authority (such as CNIL in France).",
			},
			{
				title: "10. Protection of Minors",
				body: "Our platform is exclusively intended for users aged 18 and older. We do not knowingly collect or maintain personal data from minors. Any accounts found to belong to minors will be promptly terminated and associated data deleted.",
			},
		],
		note: "For privacy questions, reach our compliance team at contact@oria.com.im or call +34637558778 (10:00 AM – 6:00 PM CET).",
		cta: "Open Studio",
	},
	terms: {
		eyebrow: "TERMS OF SERVICE",
		title: "Platform Rules & Token Policies",
		lead: "Standard platform terms governing account usage, token redemption, and creative outputs.",
		blocks: [
			{
				title: "Token Usage & Expiration",
				body: "Tokens represent prepaid digital credits for computing power. Tokens are valid for 12 months from issuance.",
			},
			{
				title: "Intellectual Property Rights",
				body: "You retain full commercial and personal rights to prompts and media generated through your authenticated account, subject to provider guidelines.",
			},
			{
				title: "Acceptable Use Policy",
				body: "Users must not generate unlawful, defamatory, or harmful content. Violations result in immediate account termination.",
			},
		],
		note: "By creating an account, you agree to these platform guidelines.",
		cta: "Agree & Enter Studio",
	},
};

export function SiteHeader() {
	return (
		<header className="site-header">
			<Link href="/" aria-label="Velora Home">
				<VeloraLogo size={36} />
			</Link>
			<nav className="nav-links">
				<Link href="/services">Services</Link>
				<Link href="/pricing">Pricing</Link>
				<Link href="/about">About us</Link>
				<Link href="/faq">FAQ</Link>
				<Link href="/guide">Field Guide</Link>
			</nav>
			<div className="flex items-center gap-3">
				<Link href="/studio" className="btn-secondary">
					Studio
				</Link>
				<Link href="/studio?auth=open" className="header-action-btn">
					Get Started <ArrowRight size={14} />
				</Link>
			</div>
		</header>
	);
}

export function SiteFooter() {
	return (
		<footer className="bg-[#120a05] border-t border-[#3a2a1a] text-[#b8ac90] py-16 px-6">
			<div className="max-w-[1380px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-12">
				<div className="md:col-span-5 flex flex-col gap-4">
					<VeloraLogo size={34} />
					<p className="text-sm leading-relaxed text-[#8a7e6f] max-w-sm">
						AI video & image generation platform with integrated human-assisted
						refinement. Pay only for what you create with transparent
						token-based pricing.
					</p>
					<div className="flex items-center gap-3 mt-4 text-xs font-semibold text-[#ffe4a6]">
						<span className="w-2 h-2 rounded-full bg-[#00a447]" /> All Neural
						Engines Operational
					</div>
				</div>

				<div className="md:col-span-2 flex flex-col gap-3 text-sm">
					<h3 className="text-xs font-extrabold uppercase tracking-widest text-[#ffe4a6] mb-2">
						Platform
					</h3>
					<Link href="/services" className="hover:text-white transition-colors">
						Services
					</Link>
					<Link href="/pricing" className="hover:text-white transition-colors">
						Pricing
					</Link>
					<Link href="/studio" className="hover:text-white transition-colors">
						Studio Workspace
					</Link>
					<Link href="/guide" className="hover:text-white transition-colors">
						Field Guide
					</Link>
				</div>

				<div className="md:col-span-2 flex flex-col gap-3 text-sm">
					<h3 className="text-xs font-extrabold uppercase tracking-widest text-[#ffe4a6] mb-2">
						Company
					</h3>
					<Link href="/about" className="hover:text-white transition-colors">
						About Us
					</Link>
					<Link href="/faq" className="hover:text-white transition-colors">
						FAQ
					</Link>
					<Link
						href="/availability"
						className="hover:text-white transition-colors"
					>
						System Status
					</Link>
				</div>

				<div className="md:col-span-3 flex flex-col gap-3 text-sm">
					<h3 className="text-xs font-extrabold uppercase tracking-widest text-[#ffe4a6] mb-2">
						Legal & Security
					</h3>
					<Link href="/terms" className="hover:text-white transition-colors">
						Terms and Conditions
					</Link>
					<Link href="/privacy" className="hover:text-white transition-colors">
						Privacy Policy
					</Link>
					<div className="text-xs text-[#8a7e6f] mt-3 leading-relaxed flex flex-col gap-1.5">
						<p className="font-semibold text-[#b8ac90]">
							ORIA · Reg. 108 261 926
						</p>
						<p>47 rue Vivienne, 75002 Paris, France</p>
						<p>
							E-mail:{" "}
							<a
								href="mailto:contact@oria.com.im"
								className="text-[#ffe4a6] hover:underline"
							>
								contact@oria.com.im
							</a>
						</p>
						<p>
							Phone:{" "}
							<a
								href="tel:+34637558778"
								className="text-[#ffe4a6] hover:underline"
							>
								+34637558778
							</a>
						</p>
						<p className="text-[11px] text-[#706456]">
							Support: 10:00 AM – 6:00 PM CET
						</p>
					</div>
				</div>
			</div>

			<div className="max-w-[1380px] mx-auto mt-12 pt-6 border-t border-[#2a1c10] flex flex-col sm:flex-row items-center justify-between text-xs text-[#8a7e6f] gap-4">
				<p>© 2026 Velora. All rights reserved.</p>
				<p className="flex items-center gap-2">
					<span>Visa</span> · <span>Mastercard</span> · <span>3D Secure</span>
				</p>
			</div>
		</footer>
	);
}

export function ContentPage({ page }: { page: SitePage }) {
	const data = pages[page];
	return (
		<div className="landing">
			<div className="announcement-bar">
				<span className="pulse-dot" /> High-Resolution 2K Video & Image
				Generation is live <ArrowUpRight size={14} />
			</div>
			<SiteHeader />
			<main className="max-w-[1100px] mx-auto px-6 py-20">
				<div className="text-xs font-extrabold uppercase tracking-widest text-[#f54900] mb-4">
					{data.eyebrow}
				</div>
				<h1 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-6 leading-tight">
					{data.title}
				</h1>
				<p className="text-lg md:text-xl text-[#b8ac90] leading-relaxed mb-16 max-w-3xl">
					{data.lead}
				</p>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
					{data.blocks.map((b, i) => (
						<div
							key={i}
							className="bg-[#1f140b] border border-[#3a2a1a] rounded-2xl p-8 hover:border-[#f54900] transition-colors"
						>
							<h2 className="text-xl font-bold text-[#ffe4a6] mb-3">
								{b.title}
							</h2>
							<p className="text-sm text-[#b8ac90] leading-relaxed">{b.body}</p>
						</div>
					))}
				</div>

				<div className="bg-[#24160c] border border-[#3a2a1a] rounded-2xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
					<div>
						<div className="text-xs uppercase font-extrabold tracking-wider text-[#ffe4a6] mb-1">
							Note
						</div>
						<div className="text-sm text-[#b8ac90]">{data.note}</div>
					</div>
					<Link href="/studio" className="header-action-btn whitespace-nowrap">
						{data.cta} <ArrowRight size={14} />
					</Link>
				</div>
			</main>
			<SiteFooter />
		</div>
	);
}
