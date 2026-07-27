import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const helperSource = fs.readFileSync(
	new URL("../public/js/umami-share.js", import.meta.url),
	"utf8",
);

function createStorage() {
	const values = new Map();
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, value),
		removeItem: (key) => values.delete(key),
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
		return jsonResponse({ id: "website-id" });
	}

	if (url.startsWith("https://gateway-us.umami.is/api/websites/website-id/stats?")) {
		return jsonResponse({ pageviews: 42, visitors: 7 });
	}

	return jsonResponse({}, 404);
};

const window = {};
vm.runInNewContext(helperSource, {
	window,
	fetch,
	localStorage: createStorage(),
	URL,
	URLSearchParams,
	Date,
	Map,
	Set,
	JSON,
	String,
	Error,
});

const stats = await window.fetchUmamiStats(
	"https://cloud.umami.is/analytics/us",
	"share-id",
	{ url: "/posts/example/", timezone: "Asia/Shanghai" },
);

assert.deepEqual(stats, { pageviews: 42, visitors: 7 });
assert.equal(requests[0].url, "https://gateway-us.umami.is/api/share/share-id");

const authenticatedRequests = requests.slice(1);
for (const { options } of authenticatedRequests) {
	assert.equal(options.headers["x-umami-share-context"], "1");
	assert.equal(options.headers["x-umami-share-token"], "share-token");
}

const statsRequest = requests.find(({ url }) => url.includes("/stats?"));
assert.ok(statsRequest);
const statsUrl = new URL(statsRequest.url);
assert.equal(statsUrl.searchParams.get("path"), "eq./posts/example/");
assert.equal(statsUrl.searchParams.get("timezone"), "Asia/Shanghai");

console.log("Umami share helper tests passed");
