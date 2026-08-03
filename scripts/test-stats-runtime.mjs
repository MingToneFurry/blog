import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(
	new URL("../public/js/blog-stats.js", import.meta.url),
	"utf8",
);

class ValueNode {
	constructor(key, text = "0") {
		this.dataset = { statsValue: key };
		this.textContent = text;
	}
}

class StatsRoot {
	constructor(scope, path) {
		this.dataset = {
			statsScope: scope,
			statsPath: path,
			statsState: "idle",
		};
		this.values = [new ValueNode("pageviews"), new ValueNode("visitors")];
		this.attributes = new Map();
		this.hidden = true;
	}
	querySelectorAll(selector) {
		return selector === "[data-stats-value]" ? this.values : [];
	}
	setAttribute(name, value) {
		this.attributes.set(name, value);
	}
	removeAttribute(name) {
		this.attributes.delete(name);
	}
}

class StatsDocument {
	constructor(roots) {
		this.roots = roots;
		this.listeners = new Map();
	}
	querySelectorAll(selector) {
		return selector === "[data-blog-stats]" ? this.roots : [];
	}
	addEventListener(name, listener) {
		this.listeners.set(name, listener);
	}
	removeEventListener(name, listener) {
		if (this.listeners.get(name) === listener) this.listeners.delete(name);
	}
}

const window = {};
const sandbox = {
	window,
	document: new StatsDocument([]),
	URL,
	Promise,
	Map,
	Number,
	String,
	Error,
	setTimeout,
	decodeURIComponent,
};
vm.runInNewContext(source, sandbox);

assert.equal(
	window.blogStats.normalizePathname("/posts/%E4%B8%AD%E6%96%87?q=1"),
	"/posts/中文/",
);

let active = 0;
let maximumActive = 0;
const calls = [];
const fetchStats = async (_baseUrl, _shareId, query) => {
	active += 1;
	maximumActive = Math.max(maximumActive, active);
	calls.push(query);
	await new Promise((resolve) => setTimeout(resolve, 4));
	active -= 1;
	return query.url?.includes("zero")
		? { pageviews: 0, visitors: { value: 0 } }
		: { pageviews: { value: 42 }, visitors: 7 };
};

window.blogStats.configure({
	baseUrl: "https://gateway-us.umami.is",
	shareId: "share-id",
	timezone: "Asia/Shanghai",
	concurrency: 2,
	retryDelays: [],
	fetchStats,
});

const configuredRuntime = window.blogStats;
vm.runInNewContext(source, sandbox);
assert.equal(
	window.blogStats,
	configuredRuntime,
	"Swup script replay must preserve the configured stats runtime instance",
);
assert.equal(window.blogStats.configure().baseUrl, "https://gateway-us.umami.is");
assert.equal(window.blogStats.configure().shareId, "share-id");

const roots = [
	new StatsRoot("site"),
	new StatsRoot("post", "/posts/中文/"),
	new StatsRoot("post", "/posts/duplicate/"),
	new StatsRoot("post", "/posts/duplicate/"),
	new StatsRoot("post", "/posts/zero/"),
];
await window.blogStats.initialize(new StatsDocument(roots));

assert.ok(
	maximumActive <= 2,
	`expected concurrency <= 2, received ${maximumActive}`,
);
assert.equal(
	calls.length,
	4,
	"duplicate scope/path pairs must share one request",
);
assert.deepEqual(
	roots[0].values.map((node) => node.textContent),
	["42", "7"],
);
assert.deepEqual(
	roots[4].values.map((node) => node.textContent),
	["0", "0"],
);
assert.ok(calls.some((query) => query.url === "/posts/中文/"));
for (const root of roots) assert.equal(root.dataset.statsState, "ready");
for (const root of roots) {
	assert.equal(root.hidden, false);
	assert.equal(root.attributes.has("aria-hidden"), false);
}

window.blogStats.reset();
let failureCalls = 0;
window.blogStats.configure({
	retryDelays: [0, 0],
	fetchStats: async () => {
		failureCalls += 1;
		throw new Error("network");
	},
});
const failed = new StatsRoot("post", "/posts/failure/");
await window.blogStats.initialize(new StatsDocument([failed]));
assert.equal(
	failureCalls,
	3,
	"initial request plus two finite retries expected",
);
assert.equal(failed.dataset.statsState, "error");
assert.equal(failed.hidden, true);
assert.equal(failed.attributes.get("aria-hidden"), "true");
assert.deepEqual(
	failed.values.map((node) => node.textContent),
	["--", "--"],
);

let recoveryCalls = 0;
window.blogStats.configure({
	retryDelays: [],
	fetchStats: async () => {
		recoveryCalls += 1;
		return { pageviews: 91, visitors: { value: 23 } };
	},
});
await window.blogStats.initialize(new StatsDocument([failed]));
assert.equal(recoveryCalls, 1, "a rejected request must be evicted so the root can retry");
assert.equal(failed.dataset.statsState, "ready");
assert.equal(failed.hidden, false);
assert.equal(failed.attributes.has("aria-hidden"), false);
assert.deepEqual(
	failed.values.map((node) => node.textContent),
	["91", "23"],
);

window.blogStats.reset();
window.blogStats.configure({
	retryDelays: [],
	fetchStats: async () => ({ pageviews: 1 }),
});
const invalid = new StatsRoot("post", "/posts/invalid/");
await window.blogStats.initialize(new StatsDocument([invalid]));
assert.equal(invalid.dataset.statsState, "error");
assert.equal(invalid.hidden, true, "a response missing PV or UV must hide the full group");
assert.equal(invalid.attributes.get("aria-hidden"), "true");

console.log("Stats runtime tests passed");
