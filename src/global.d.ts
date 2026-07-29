import type { AstroIntegration } from "@swup/astro";

type UmamiStatValue = number | { value: number };

type UmamiStats = {
	pageviews?: UmamiStatValue;
	visitors?: UmamiStatValue;
	visits?: UmamiStatValue;
	_fromCache?: boolean;
	[key: string]: unknown;
};

type BlogStatsRuntime = {
	configure: (config: {
		baseUrl?: string;
		shareId?: string;
		timezone?: string;
		concurrency?: number;
		retryDelays?: number[];
	}) => unknown;
	initialize: (root?: ParentNode) => Promise<void>;
	bindLifecycle: (target?: Document) => () => void;
	normalizePathname: (path: string) => string;
	reset: () => void;
};

type BlogBackgroundRuntime = {
	initialize: (root?: ParentNode) => Promise<void>;
	bindLifecycle: (target?: Document) => () => void;
	reset: () => void;
};

declare global {
	interface Window {
		// type from '@swup/astro' is incorrect
		swup: AstroIntegration;
		getUmamiShareData?: (
			baseUrl: string,
			shareId: string,
		) => Promise<{ websiteId: string; token: string; apiBase: string }>;
		clearUmamiShareCache?: (baseUrl?: string, shareId?: string) => void;
		fetchUmamiStats?: (
			baseUrl: string,
			shareId: string,
			queryParams?: Record<string, string | number>,
		) => Promise<UmamiStats>;
		blogStats?: BlogStatsRuntime;
		blogBackground?: BlogBackgroundRuntime;
	}
}
