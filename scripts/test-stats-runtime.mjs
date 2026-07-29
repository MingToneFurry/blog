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
	}
	querySelectorAll(selector) {
		return selector === "[data-stats-value]" ? this.values : [];
	}
	setAttribute(name, value) {
		this.attributes.set(name, value);
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
vm.runInNewContext(source, {
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
});

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
assert.deepEqual(
	failed.values.map((node) => node.textContent),
	["--", "--"],
);

console.log("Stats runtime tests passed");
