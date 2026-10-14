export function VeloraLogo({ size = 32 }: { size?: number }) {
	return (
		<div className="flex items-center gap-2.5 font-extrabold tracking-tight select-none">
			<svg
				width={size}
				height={size}
				viewBox="0 0 40 40"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				className="shrink-0"
			>
				<defs>
					<radialGradient
						id="velora_g1"
						cx="0"
						cy="0"
						r="1"
						gradientTransform="matrix(38 0 0 38 10 10)"
						gradientUnits="userSpaceOnUse"
					>
						<stop stopColor="#f3913e" />
						<stop offset="0.55" stopColor="#f54900" />
						<stop offset="1" stopColor="#e93e3a" />
					</radialGradient>
				</defs>
				<rect width="40" height="40" rx="12" fill="#24160c" stroke="#3a2a1a" />
				<path d="M12 11L28 11L20 29L12 11Z" fill="url(#velora_g1)" />
				<circle cx="20" cy="18" r="3.5" fill="#ffe4a6" />
			</svg>
			<span className="text-xl tracking-tight text-white font-black">
				Velora <span className="text-[#f3913e]">AI</span>
			</span>
		</div>
	);
}
