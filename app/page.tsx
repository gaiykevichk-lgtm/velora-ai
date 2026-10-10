import Link from "next/link";
import { ExampleGallery } from "./example-gallery";
import { SiteHeader, SiteFooter } from "./site-content";
import {
	ArrowRight,
	ArrowUpRight,
	Check,
	Coins,
	Clapperboard,
	Cpu,
	Image as ImageIcon,
	MessageCircle,
	Sparkles,
	ShieldCheck,
	Zap,
} from "lucide-react";

export default function Home() {
	return (
		<div className="landing" id="top">
			<div className="announcement-bar">
				<span className="pulse-dot" /> High-Resolution 2K Video & Image
				Generation is live · Pay as you create <ArrowUpRight size={14} />
			</div>
			<SiteHeader />

			<main>
				{/* Hero Section */}
				<section className="hero-section">
					<div className="badge-tag">
						<Sparkles size={14} className="text-[#f54900]" />
						<span>AI Video & Image Platform · Pay As You Go</span>
					</div>

					<h1 className="hero-title">
						Create Professional Videos <br />
						<span className="gradient-text">from your ideas instantly.</span>
					</h1>

					<p className="hero-subtitle">
						No editing skills required — describe your concept and let reliable
						AI engines generate production-ready video, photorealistic images,
						and storylines in seconds.
					</p>

					<div className="hero-cta-row">
						<Link
							href="/studio"
							className="header-action-btn text-base px-8 py-3.5"
						>
							Start Creating Free (500 Tokens) <ArrowRight size={18} />
						</Link>
						<Link
							href="/pricing"
							className="btn-secondary text-base px-7 py-3.5"
						>
							<Coins size={16} className="text-[#ffe4a6]" /> View Token Pricing
						</Link>
					</div>

					{/* Metrics banner */}
					<div className="hero-metric-grid">
						<div className="metric-card">
							<div className="metric-num">3 AI Engines</div>
							<div className="metric-label">
								Gemini 3.8 Flash, Qwen Image 3 Pro, Hailuo 3
							</div>
						</div>
						<div className="metric-card">
							<div className="metric-num">0 Subscriptions</div>
							<div className="metric-label">
								Prepaid tokens that never expire prematurely
							</div>
						</div>
						<div className="metric-card">
							<div className="metric-num">2K HD Motion</div>
							<div className="metric-label">
								Native cinematic resolutions with smooth physics
							</div>
						</div>
					</div>
				</section>

				<ExampleGallery compact />

				{/* What We Do / Hybrid Platform */}
				<section className="section-container border-t border-[#3a2a1a]/40">
					<div className="text-center max-w-2xl mx-auto">
						<div className="section-eyebrow">Hybrid AI + Creative Platform</div>
						<h2 className="section-heading">Designed for Teams & Creators</h2>
						<p className="section-desc mx-auto">
							velora helps creators, marketing agencies, and founders produce
							professional visual content faster and smarter — with AI speed and
							human precision.
						</p>
					</div>

					<div className="feature-grid">
						<div className="feature-card">
							<div className="feature-icon-wrapper">
								<Clapperboard size={24} />
							</div>
							<h3 className="feature-title">From Idea to Motion</h3>
							<p className="feature-body">
								Turn written prompts into full-length cinematic video clips with
								AI-generated scenes, consistent motion dynamics, and precise
								camera controls.
							</p>
							<div className="mt-auto pt-4 text-xs font-bold text-[#f54900] flex items-center gap-1.5">
								100 tokens / 2K video clip <ArrowRight size={12} />
							</div>
						</div>

						<div className="feature-card">
							<div className="feature-icon-wrapper">
								<ImageIcon size={24} />
							</div>
							<h3 className="feature-title">Multi-Style Visuals</h3>
							<p className="feature-body">
								Generate stunning product photography, concept art, and
								high-impact thumbnails. Upload reference images to guide
								composition and style.
							</p>
							<div className="mt-auto pt-4 text-xs font-bold text-[#f54900] flex items-center gap-1.5">
								25 tokens / generation <ArrowRight size={12} />
							</div>
						</div>

						<div className="feature-card">
							<div className="feature-icon-wrapper">
								<MessageCircle size={24} />
							</div>
							<h3 className="feature-title">Smart Prompt Control</h3>
							<p className="feature-body">
								Structure complex video scripts, creative treatments, and
								scene-by-scene storyboards using our rapid multi-turn text
								companion.
							</p>
							<div className="mt-auto pt-4 text-xs font-bold text-[#f54900] flex items-center gap-1.5">
								5 tokens / conversation query <ArrowRight size={12} />
							</div>
						</div>
					</div>
				</section>

				{/* Token Economics Section */}
				<section className="section-container border-t border-[#3a2a1a]/40 bg-[#120a05]">
					<div className="max-w-4xl mx-auto">
						<div className="text-center">
							<div className="section-eyebrow">Transparent Pricing</div>
							<h2 className="section-heading">Flexible Token-Based Balance</h2>
							<p className="section-desc mx-auto">
								No monthly commitments. Top up tokens in fiat and spend them
								across all AI studios. Every new account gets 500 tokens
								immediately.
							</p>
						</div>

						<div className="token-table-card">
							<div className="token-row header">
								<span>Generation Type</span>
								<span>Model Engine</span>
								<span>Output Quality</span>
								<span className="text-right">Token Cost</span>
							</div>

							<div className="token-row">
								<span className="font-bold text-white flex items-center gap-2">
									<MessageCircle size={16} className="text-[#ffe4a6]" /> Script
									& Storyline
								</span>
								<span className="text-[#b8ac90]">Gemini 3.8 Flash</span>
								<span className="text-[#b8ac90]">Multi-turn text</span>
								<span className="text-right font-extrabold text-[#ffe4a6]">
									5 tokens
								</span>
							</div>

							<div className="token-row">
								<span className="font-bold text-white flex items-center gap-2">
									<ImageIcon size={16} className="text-[#f3913e]" /> Image
									Generation
								</span>
								<span className="text-[#b8ac90]">Qwen Image 3 Pro</span>
								<span className="text-[#b8ac90]">HD Base64 render</span>
								<span className="text-right font-extrabold text-[#f3913e]">
									25 tokens
								</span>
							</div>

							<div className="token-row">
								<span className="font-bold text-white flex items-center gap-2">
									<Clapperboard size={16} className="text-[#f54900]" /> 2K
									Motion Video
								</span>
								<span className="text-[#b8ac90]">MiniMax Hailuo 3</span>
								<span className="text-[#b8ac90]">2K up to 10s MP4</span>
								<span className="text-right font-extrabold text-[#f54900]">
									100 tokens
								</span>
							</div>
						</div>

						{/* Pricing Packages */}
						<div className="pricing-cards-grid">
							<div className="pricing-card">
								<h4 className="text-lg font-bold text-white">Starter</h4>
								<div className="pricing-price">$10</div>
								<div className="pricing-tokens">1,000 tokens</div>
								<ul className="pricing-features">
									<li>
										<Check size={14} className="text-[#00a447]" /> 200 text
										queries
									</li>
									<li>
										<Check size={14} className="text-[#00a447]" /> 40 image
										renders
									</li>
									<li>
										<Check size={14} className="text-[#00a447]" /> 10 video
										clips
									</li>
									<li>
										<Check size={14} className="text-[#00a447]" /> Valid for 12
										months
									</li>
								</ul>
								<Link
									href="/studio"
									className="btn-secondary justify-center w-full"
								>
									Select Starter
								</Link>
							</div>

							<div className="pricing-card featured">
								<div className="pricing-badge">Popular</div>
								<h4 className="text-lg font-bold text-white">Creator</h4>
								<div className="pricing-price">$20</div>
								<div className="pricing-tokens">2,500 tokens</div>
								<ul className="pricing-features">
									<li>
										<Check size={14} className="text-[#00a447]" /> 500 text
										queries
									</li>
									<li>
										<Check size={14} className="text-[#00a447]" /> 100 image
										renders
									</li>
									<li>
										<Check size={14} className="text-[#00a447]" /> 25 video
										clips
									</li>
									<li>
										<Check size={14} className="text-[#00a447]" /> Priority GPU
										processing
									</li>
								</ul>
								<Link
									href="/studio"
									className="header-action-btn justify-center w-full"
								>
									Top Up Creator
								</Link>
							</div>

							<div className="pricing-card">
								<h4 className="text-lg font-bold text-white">Pro Studio</h4>
								<div className="pricing-price">$50</div>
								<div className="pricing-tokens">7,000 tokens</div>
								<ul className="pricing-features">
									<li>
										<Check size={14} className="text-[#00a447]" /> 1,400 text
										queries
									</li>
									<li>
										<Check size={14} className="text-[#00a447]" /> 280 image
										renders
									</li>
									<li>
										<Check size={14} className="text-[#00a447]" /> 70 video
										clips
									</li>
									<li>
										<Check size={14} className="text-[#00a447]" /> Dedicated API
										capacity
									</li>
								</ul>
								<Link
									href="/studio"
									className="btn-secondary justify-center w-full"
								>
									Select Pro
								</Link>
							</div>

							<div className="pricing-card">
								<h4 className="text-lg font-bold text-white">Scale</h4>
								<div className="pricing-price">$100</div>
								<div className="pricing-tokens">15,000 tokens</div>
								<ul className="pricing-features">
									<li>
										<Check size={14} className="text-[#00a447]" /> Best value
										per token
									</li>
									<li>
										<Check size={14} className="text-[#00a447]" /> 600 image
										renders
									</li>
									<li>
										<Check size={14} className="text-[#00a447]" /> 150 video
										clips
									</li>
									<li>
										<Check size={14} className="text-[#00a447]" /> Full agency
										support
									</li>
								</ul>
								<Link
									href="/studio"
									className="btn-secondary justify-center w-full"
								>
									Select Scale
								</Link>
							</div>
						</div>
					</div>
				</section>

				{/* Quick answers / FAQ */}
				<section className="section-container border-t border-[#3a2a1a]/40">
					<div className="text-center max-w-2xl mx-auto">
						<div className="section-eyebrow">FAQ</div>
						<h2 className="section-heading">Quick Answers</h2>
					</div>

					<div className="faq-container">
						<div className="faq-item">
							<div className="faq-question">
								How does velora token-based pricing work?
							</div>
							<div className="faq-answer">
								velora uses a token-based system. You add tokens to your balance
								and tokens are deducted each time you generate a video, image,
								or text response. You only pay for what you use, with no
								subscriptions or fixed monthly fees.
							</div>
						</div>

						<div className="faq-item">
							<div className="faq-question">
								Do I need a subscription to use velora?
							</div>
							<div className="faq-answer">
								No. velora does not require any subscription. You can add tokens
								at any time and use them whenever you need to create content.
							</div>
						</div>

						<div className="faq-item">
							<div className="faq-question">Do tokens expire?</div>
							<div className="faq-answer">
								Tokens are valid for 12 months after the date of purchase. Any
								unused tokens will automatically remain active during this
								period.
							</div>
						</div>

						<div className="faq-item">
							<div className="faq-question">Can I test before paying?</div>
							<div className="faq-answer">
								Yes! Every newly created account receives 500 complimentary
								welcome tokens to test the studio, image models, and video
								rendering immediately.
							</div>
						</div>
					</div>

					<div className="mt-16 text-center">
						<Link
							href="/studio"
							className="header-action-btn text-base px-8 py-3.5"
						>
							Enter Studio & Start Creating <ArrowRight size={16} />
						</Link>
					</div>
				</section>
			</main>

			<SiteFooter />
		</div>
	);
}
