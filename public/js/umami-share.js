((global) => {
	const SHARE_CACHE_PREFIX = "umami-share-cache:";
	const SHARE_CACHE_TTL = 3600_000; // 1h

	// In-memory caches (per page load)
	const dataCache = (global.__umamiDataCache = global.__umamiDataCache || new Map());
	const sharePromises = (global.__umamiSharePromises =
		global.__umamiSharePromises || new Map());

	function normalizeBaseUrl(baseUrl) {
		if (!baseUrl) return "";
		return String(baseUrl).replace(/\/+$/, "");
	}

	function getShareCacheKey(baseUrl, shareId) {
		return `${SHARE_CACHE_PREFIX}${normalizeBaseUrl(baseUrl)}|${shareId}`;
	}

	function safeGetItem(key) {
		try {
			return localStorage.getItem(key);
		} catch {
			return null;
		}
	}

	function safeSetItem(key, value) {
		try {
			localStorage.setItem(key, value);
		} catch {
			// Ignore (e.g. iOS Safari private mode)
		}
	}

	function safeRemoveItem(key) {
		try {
			localStorage.removeItem(key);
		} catch {
			// Ignore
		}
	}

	function uniq(arr) {
		const seen = new Set();
		const out = [];
		for (const item of arr) {
			if (!item || seen.has(item)) continue;
			seen.add(item);
			out.push(item);
		}
		return out;
	}

	/**
	 * Build candidate API bases for Umami Cloud / self-hosted.
	 * - Self-hosted: https://umami.example.com
	 * - Umami Cloud v3 may serve UI under /analytics/{region}/..., while API lives under the same basePath.
	 */
	function buildBaseCandidates(baseUrl) {
		const normalized = normalizeBaseUrl(baseUrl);
		const candidates = [normalized];

		try {
			const u = new URL(normalized);
			const origin = u.origin;
			const pathname = (u.pathname || "/").replace(/\/+$/, "");

			// If user configured a path (e.g. /analytics/eu), also try origin-only.
			if (pathname && pathname !== "/") {
				candidates.push(origin);
			}

			// Umami Cloud region fallbacks (common regions: eu / us)
			if (origin.includes("cloud.umami.is") && !normalized.includes("/analytics/")) {
				candidates.push(`${origin}/analytics/eu`);
				candidates.push(`${origin}/analytics/us`);
			}
		} catch {
			// ignore URL parse errors
		}

		return uniq(candidates.map(normalizeBaseUrl));
	}

	async function fetchShareFrom(apiBase, shareId) {
		const res = await fetch(`${apiBase}/api/share/${shareId}`, {
			method: "GET",
			headers: { Accept: "application/json" },
			credentials: "omit",
		});

		if (!res.ok) {
			const err = new Error(`Umami share API 请求失败 (HTTP ${res.status})`);
			// @ts-ignore
			err.status = res.status;
			throw err;
		}

		const data = await res.json();

		// Try to be compatible with possible response shapes
		const websiteId =
			data?.websiteId || data?.website_id || data?.website?.id || data?.website?.websiteId;
		const token =
			data?.token ||
			data?.shareToken ||
			data?.share_token ||
			data?.accessToken ||
			data?.access_token;

		if (!websiteId || !token) {
			throw new Error("Umami share API 返回格式不符合预期（缺少 websiteId 或 token）");
		}

		return { websiteId, token };
	}

	async function fetchShareData(baseUrl, shareId) {
		const shareCacheKey = getShareCacheKey(baseUrl, shareId);

		// LocalStorage cache (TTL)
		const cached = safeGetItem(shareCacheKey);
		if (cached) {
			try {
				const parsed = JSON.parse(cached);
				if (Date.now() - parsed.timestamp < SHARE_CACHE_TTL) {
					return parsed.value;
				}
			} catch {
				safeRemoveItem(shareCacheKey);
			}
		}

		const candidates = buildBaseCandidates(baseUrl);
		let lastErr;

		for (const apiBase of candidates) {
			try {
				const { websiteId, token } = await fetchShareFrom(apiBase, shareId);
				const value = { websiteId, token, apiBase };
				safeSetItem(
					shareCacheKey,
					JSON.stringify({ timestamp: Date.now(), value }),
				);
				return value;
			} catch (err) {
				lastErr = err;
				// continue trying other candidates
			}
		}

		throw lastErr || new Error("获取 Umami 分享信息失败");
	}

	/**
	 * Get Umami share data (websiteId, token, apiBase).
	 * Reuse the same Promise to avoid duplicate concurrent requests.
	 */
	global.getUmamiShareData = (baseUrl, shareId) => {
		const key = `${normalizeBaseUrl(baseUrl)}|${shareId}`;
		if (sharePromises.has(key)) return sharePromises.get(key);

		const p = fetchShareData(baseUrl, shareId).catch((err) => {
			sharePromises.delete(key);
			throw err;
		});
		sharePromises.set(key, p);
		return p;
	};

	/**
	 * Clear Umami share cache.
	 * - If baseUrl/shareId provided: clear only that entry
	 * - Else: clear all in-memory promises (and keep localStorage untouched)
	 */
	global.clearUmamiShareCache = (baseUrl, shareId) => {
		if (baseUrl && shareId) {
			safeRemoveItem(getShareCacheKey(baseUrl, shareId));
			sharePromises.delete(`${normalizeBaseUrl(baseUrl)}|${shareId}`);
			return;
		}
		sharePromises.clear();
	};

	/**
	 * Fetch Umami stats via Share API.
	 * Adds an in-memory cache layer to reduce repeated requests.
	 */
	global.fetchUmamiStats = async (baseUrl, shareId, queryParams = {}) => {
		const cacheKey = `${normalizeBaseUrl(baseUrl)}|${shareId}|${JSON.stringify(queryParams)}`;

		if (dataCache.has(cacheKey)) {
			const data = dataCache.get(cacheKey);
			return { ...data, _fromCache: true };
		}

		async function doFetch(isRetry = false) {
			const { websiteId, token, apiBase } = await global.getUmamiShareData(
				baseUrl,
				shareId,
			);

			const now = Date.now();
			const params = new URLSearchParams({
				startAt: 0,
				endAt: now,
				unit: "hour",
				timezone: queryParams.timezone || "Asia/Shanghai",
				compare: "false",
				...queryParams,
			});

			const statsUrl = `${apiBase}/api/websites/${websiteId}/stats?${params.toString()}`;

			const res = await fetch(statsUrl, {
				headers: {
					"x-umami-share-token": token,
					Accept: "application/json",
				},
				credentials: "omit",
			});

			if (!res.ok) {
				if (res.status === 401 && !isRetry) {
					// token may have expired, retry once after clearing share cache
					global.clearUmamiShareCache(baseUrl, shareId);
					return doFetch(true);
				}
				throw new Error(`获取统计数据失败 (HTTP ${res.status})`);
			}

			const data = await res.json();
			dataCache.set(cacheKey, data);
			return data;
		}

		return doFetch(false);
	};
})(window);
