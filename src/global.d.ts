import type { AstroIntegration } from "@swup/astro";

type UmamiStatValue = number | { value: number };

type UmamiStats = {
	pageviews?: UmamiStatValue;
	visitors?: UmamiStatValue;
	visits?: UmamiStatValue;
	_fromCache?: boolean;
	[key: string]: unknown;
};

declare global {
	interface Window {
		// type from '@swup/astro' is incorrect
		swup: AstroIntegration;
		getUmamiShareData?: (
			baseUrl: string,
			shareId: string,
		) => Promise<{
			websiteId: string;
			token: string;
			apiBase: string;
			lifetimeStartAt: number;
		}>;
		clearUmamiShareCache?: (baseUrl?: string, shareId?: string) => void;
		fetchUmamiStats?: (
			baseUrl: string,
			shareId: string,
			queryParams?: Record<string, string | number | boolean>,
		) => Promise<UmamiStats>;
	}
}
