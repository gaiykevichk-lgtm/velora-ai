// Single source of truth for operator details shown across the site.
export const COMPANY = {
	name: "Omnix21",
	registration: "107 643 348 R.C.S. Paris",
	country: "France",
	address: "47 rue Vivienne, 75002 Paris, France",
	email: "contact@omnix-21.com",
	phone: "+33 6 87 35 58 25",
	phoneHref: "tel:+33687355825",
	supportHours: "Monday–Friday, 09:00–18:00 (Paris time)",
	platformName: "Velora AI",
	platformUrl: "https://veloraai.pro",
} as const;

// Rate derived from the agreed packages (€20 = 2,000 and €100 = 10,000).
export const TOKENS_PER_EUR = 100;
