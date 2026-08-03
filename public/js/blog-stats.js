((global) => {
	const RUNTIME_ID = "fuwari-blog-stats-v1";
	const existingRuntime = global.blogStats;
	if (existingRuntime?.runtimeId === RUNTIME_ID) {
		existingRuntime.configure(global.__BLOG_STATS_CONFIG__ || {});
		if (typeof document !== "undefined") existingRuntime.bindLifecycle(document);
		return;
	}

	const DEFAULT_RETRY_DELAYS = [250, 750];
	const resultCache = new Map();
	const queue = [];
	let activeRequests = 0;
	let lifecycleTarget = null;
	let lifecycleCleanup = null;
	let config = {
		enabled: true,
		baseUrl: "",
		shareId: "",
		timezone: "Asia/Shanghai",
		concurrency: 4,
		retryDelays: DEFAULT_RETRY_DELAYS,
		requestTimeout: 8000,
		fetchStats: null,
		...(global.__BLOG_STATS_CONFIG__ || {}),
	};

	function configure(next = {}) {
		config = {
			...config,
			...next,
			concurrency: Math.max(
				1,
				Math.floor(Number(next.concurrency ?? config.concurrency) || 4),
			),
			requestTimeout: Math.max(
				1,
				Number(next.requestTimeout ?? config.requestTimeout) || 8000,
			),
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
			// Keep malformed percent sequences unchanged.
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
		const ready = state === "ready";
		root.dataset.statsState = state;
		root.hidden = !ready;
		root.setAttribute?.("aria-hidden", String(!ready));
		root.setAttribute?.("aria-busy", state === "loading" ? "true" : "false");
		for (const node of getValueNodes(root)) {
			node.dataset.statsState = state;
			if (!ready) node.textContent = "";
		}
	}

	function getNumericValue(value) {
		const candidate = value && typeof value === "object" ? value.value : value;
		return typeof candidate === "number" &&
			Number.isFinite(candidate) &&
			candidate >= 0
			? candidate
			: null;
	}

	function normalizeStats(stats) {
		const pageviews = getNumericValue(stats?.pageviews);
		const visitors = getNumericValue(stats?.visitors);
		if (pageviews === null || visitors === null) {
			throw new Error("Umami stats response is missing valid pageviews or visitors");
		}
		return { pageviews, visitors };
	}

	function applyStats(root, stats) {
		const nodes = getValueNodes(root);
		const keys = new Set(nodes.map((node) => node.dataset.statsValue));
		if (!keys.has("pageviews") || !keys.has("visitors")) {
			throw new Error("Stats root is missing a PV or UV value node");
		}

		for (const node of nodes) {
			const key = node.dataset.statsValue;
			if (key !== "pageviews" && key !== "visitors") continue;
			node.textContent = String(stats[key]);
		}
		setState(root, "ready");
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
		if (
			!config.enabled ||
			typeof fetchStats !== "function" ||
			!config.baseUrl ||
			!config.shareId
		) {
			throw new Error("Blog stats runtime is not configured");
		}

		let lastError;
		for (let attempt = 0; attempt <= config.retryDelays.length; attempt += 1) {
			try {
				let timeout;
				const response = await Promise.race([
					fetchStats(config.baseUrl, config.shareId, query),
					new Promise((_, reject) => {
						timeout = setTimeout(
							() => reject(new Error("Blog stats request timed out")),
							config.requestTimeout,
						);
					}),
				]).finally(() => clearTimeout(timeout));
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
		const path =
			scope === "post"
				? normalizePathname(root.dataset.statsPath || "/")
				: null;
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
			const request = schedule(() => requestStats(query));
			resultCache.set(key, request);
			void request.catch(() => {
				if (resultCache.get(key) === request) resultCache.delete(key);
			});
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
			for (const eventName of events) {
				target.removeEventListener(eventName, initializePage);
			}
			if (lifecycleTarget === target) lifecycleTarget = null;
			lifecycleCleanup = null;
		};
		return lifecycleCleanup;
	}

	global.blogStats = {
		runtimeId: RUNTIME_ID,
		configure,
		initialize,
		bindLifecycle,
		normalizePathname,
		reset() {
			resultCache.clear();
		},
	};

	if (typeof document !== "undefined") bindLifecycle(document);
})(window);
