import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const helperSource = fs.readFileSync(
	new URL("../public/js/umami-share.js", import.meta.url),
	"utf8",
);

function createStorage(initialValues = {}) {
	const values = new Map(Object.entries(initialValues));
	return {
		get length() {
			return values.size;
		},
		key: (index) => [...values.keys()][index] ?? null,
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, value),
		removeItem: (key) => values.delete(key),
		entries: () => [...values.entries()],
	};
}

function jsonResponse(data, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => data,
	};
}

const requests = [];
const fetch = async (input, options = {}) => {
	const url = String(input);
	requests.push({ url, options });

	if (url === "https://gateway-us.umami.is/api/share/share-id") {
		return jsonResponse({ websiteId: "website-id", token: "share-token" });
	}

	if (url === "https://gateway-us.umami.is/api/websites/website-id") {
		return jsonResponse({
			id: "website-id",
			createdAt: "2025-07-06T04:54:09.999Z",
			resetAt: "2025-08-01T00:00:00.000Z",
		});
	}

	if (url.startsWith("https://gateway-us.umami.is/api/websites/website-id/stats?")) {
		if (new URL(url).searchParams.get("path") === "eq./posts/no-comparison/") {
			return jsonResponse({ pageviews: 1, visitors: 1 });
		}
		return jsonResponse({
			pageviews: 42,
			visitors: 7,
			comparison: { pageviews: 100, visitors: 20 },
		});
	}

	return jsonResponse({}, 404);
};

const fixedNow = Date.UTC(2026, 6, 29, 12, 0, 0);
class FixedDate extends Date {
	static now() {
		return fixedNow;
	}
}

const window = {};
const storage = createStorage({
	"umami-share-cache:v3:legacy": JSON.stringify({
		value: { token: "persisted-share-token" },
	}),
});
vm.runInNewContext(helperSource, {
	window,
	fetch,
	localStorage: storage,
	URL,
	URLSearchParams,
	Date: FixedDate,
	Map,
	Set,
	JSON,
	String,
	Error,
});

assert.deepEqual(storage.entries(), []);

const stats = await window.fetchUmamiStats(
	"https://cloud.umami.is/analytics/us",
	"share-id",
	{ url: "/posts/example/", timezone: "Asia/Shanghai" },
);

assert.equal(stats.pageviews, 100);
assert.equal(stats.visitors, 20);
assert.deepEqual(stats.comparison, { pageviews: 100, visitors: 20 });
assert.equal(requests[0].url, "https://gateway-us.umami.is/api/share/share-id");

const authenticatedRequests = requests.slice(1);
for (const { options } of authenticatedRequests) {
	assert.equal(options.headers["x-umami-share-context"], "1");
	assert.equal(options.headers["x-umami-share-token"], "share-token");
}

const statsRequest = requests.find(({ url }) => url.includes("/stats?"));
assert.ok(statsRequest);
const statsUrl = new URL(statsRequest.url);
const openedAt = Date.parse("2025-08-01T00:00:00.000Z");
const snapshotAt = Math.ceil(fixedNow / 60_000) * 60_000;
const durationMinutes = Math.ceil((snapshotAt - openedAt) / 60_000);
assert.equal(statsUrl.searchParams.get("startAt"), String(snapshotAt));
assert.equal(
	statsUrl.searchParams.get("endAt"),
	String(snapshotAt + durationMinutes * 60_000),
);
assert.equal(statsUrl.searchParams.get("compare"), "prev");
assert.equal(statsUrl.searchParams.get("path"), "eq./posts/example/");
assert.equal(statsUrl.searchParams.get("timezone"), "Asia/Shanghai");
assert.equal(statsUrl.searchParams.has("lifetime"), false);
await assert.rejects(
	window.fetchUmamiStats(
		"https://cloud.umami.is/analytics/us",
		"share-id",
		{ url: "/posts/no-comparison/", timezone: "Asia/Shanghai" },
	),
	/未返回 lifetime comparison/,
);
assert.deepEqual(storage.entries(), []);

console.log("Umami share helper tests passed");
