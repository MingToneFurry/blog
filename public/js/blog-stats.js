((global) => {
	const DEFAULT_RETRY_DELAYS = [250, 750];
	const resultCache = new Map();
	const queue = [];
	let activeRequests = 0;
	let lifecycleTarget = null;
	let lifecycleCleanup = null;
	let config = {
		baseUrl: "",
		shareId: "",
		timezone: "Asia/Shanghai",
		concurrency: 4,
		retryDelays: DEFAULT_RETRY_DELAYS,
		fetchStats: null,
	};

	function configure(next = {}) {
		config = {
			...config,
			...next,
			concurrency: Math.max(1, Math.floor(Number(next.concurrency ?? config.concurrency) || 4)),
			retryDelays: Array.isArray(next.retryDelays)
				? next.retryDelays.map((delay) => Math.max(0, Number(delay) || 0))
				: config.retryDelays,
		};
		return { ...config, retryDelays: [...config.retryDelays] };
	}

	function normalizePathname(input) {
		const raw = String(input || "/").trim();
		let pathname = raw;
		try {
			pathname = new URL(raw, "https://blog.invalid").pathname;
		} catch {
			pathname = raw.split(/[?#]/, 1)[0] || "/";
		}
		try {
			pathname = decodeURIComponent(pathname);
		} catch {
			// Preserve malformed percent sequences.
		}
		pathname = pathname.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
		if (!pathname.startsWith("/")) pathname = `/${pathname}`;
		if (pathname !== "/" && !pathname.endsWith("/")) pathname += "/";
		return pathname;
	}

	function getValueNodes(root) {
		return [...root.querySelectorAll("[data-stats-value]")];
	}

	function setState(root, state) {
		root.dataset.statsState = state;
		root.setAttribute?.("aria-busy", state === "loading" ? "true" : "false");
		for (const node of getValueNodes(root)) {
			node.dataset.statsState = state;
			if (state !== "ready") node.textContent = "--";
		}
	}

	function getNumericValue(value) {
		const candidate = value && typeof value === "object" ? value.value : value;
		return typeof candidate === "number" && Number.isFinite(candidate)
			? candidate
			: null;
	}

	function normalizeStats(stats) {
		const pageviews = getNumericValue(stats?.pageviews);
		const visitors = getNumericValue(stats?.visitors);
		if (pageviews === null || visitors === null) {
			throw new Error("Umami stats response is missing pageviews or visitors");
		}
		return { pageviews, visitors };
	}

	function applyStats(root, stats) {
		for (const node of getValueNodes(root)) {
			const key = node.dataset.statsValue;
			if (key !== "pageviews" && key !== "visitors") continue;
			node.textContent = String(stats[key]);
			node.dataset.statsState = "ready";
		}
		root.dataset.statsState = "ready";
		root.setAttribute?.("aria-busy", "false");
	}

	function sleep(milliseconds) {
		return new Promise((resolve) => setTimeout(resolve, milliseconds));
	}

	function runNext() {
		while (activeRequests < config.concurrency && queue.length > 0) {
			const item = queue.shift();
			activeRequests += 1;
			Promise.resolve()
				.then(item.task)
				.then(item.resolve, item.reject)
				.finally(() => {
					activeRequests -= 1;
					runNext();
				});
		}
	}

	function schedule(task) {
		return new Promise((resolve, reject) => {
			queue.push({ task, resolve, reject });
			runNext();
		});
	}

	async function requestStats(query) {
		const fetchStats = config.fetchStats || global.fetchUmamiStats;
		if (typeof fetchStats !== "function" || !config.baseUrl || !config.shareId) {
			throw new Error("Blog stats runtime is not configured");
		}

		let lastError;
		for (let attempt = 0; attempt <= config.retryDelays.length; attempt += 1) {
			try {
				const response = await fetchStats(config.baseUrl, config.shareId, query);
				return normalizeStats(response);
			} catch (error) {
				lastError = error;
				if (attempt < config.retryDelays.length) {
					await sleep(config.retryDelays[attempt]);
				}
			}
		}
		throw lastError;
	}

	function getRootRequest(root) {
		const scope = root.dataset.statsScope === "site" ? "site" : "post";
		const path = scope === "post" ? normalizePathname(root.dataset.statsPath || "/") : null;
		return {
			key: scope === "site" ? "site" : `post:${path}`,
			query: {
				timezone: config.timezone,
				...(path ? { url: path } : {}),
			},
		};
	}

	function getStats(key, query) {
		if (!resultCache.has(key)) {
			resultCache.set(key, schedule(() => requestStats(query)));
		}
		return resultCache.get(key);
	}

	async function hydrateRoot(root) {
		if (root.dataset.statsState === "ready") return;
		setState(root, "loading");
		const { key, query } = getRootRequest(root);
		try {
			applyStats(root, await getStats(key, query));
		} catch {
			setState(root, "error");
		}
	}

	async function initialize(root = document) {
		const roots = [...root.querySelectorAll("[data-blog-stats]")];
		await Promise.all(roots.map(hydrateRoot));
	}

	function bindLifecycle(target = document) {
		if (lifecycleTarget === target && lifecycleCleanup) return lifecycleCleanup;
		lifecycleCleanup?.();

		const initializePage = () => {
			void initialize(target);
		};
		const events = [
			"DOMContentLoaded",
			"astro:page-load",
			"astro:after-swap",
			"swup:contentReplaced",
			"content:replace",
		];
		for (const eventName of events) target.addEventListener(eventName, initializePage);
		initializePage();

		lifecycleTarget = target;
		lifecycleCleanup = () => {
			for (const eventName of events) target.removeEventListener(eventName, initializePage);
			if (lifecycleTarget === target) lifecycleTarget = null;
			lifecycleCleanup = null;
		};
		return lifecycleCleanup;
	}

	global.blogStats = {
		configure,
		initialize,
		bindLifecycle,
		normalizePathname,
		reset() {
			resultCache.clear();
		},
	};
})(window);
