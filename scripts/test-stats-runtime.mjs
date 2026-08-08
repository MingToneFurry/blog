import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(
	new URL("../public/js/blog-stats.js", import.meta.url),
	"utf8",
);

class ValueNode {
	constructor(key, text = "") {
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
		this.attributes = new Map([
			["aria-hidden", "true"],
			["aria-busy", "false"],
		]);
		this.hidden = true;
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
		this.addCalls = 0;
	}
	querySelectorAll(selector) {
		return selector === "[data-blog-stats]" ? this.roots : [];
	}
	addEventListener(name, listener) {
		this.addCalls += 1;
		this.listeners.set(name, listener);
	}
	removeEventListener(name, listener) {
		if (this.listeners.get(name) === listener) this.listeners.delete(name);
	}
}

const runtimeDocument = new StatsDocument([]);
runtimeDocument.documentElement = { dataset: {} };
const window = { __BLOG_STATS_CONFIG__: { enabled: false } };
const runtimeContext = {
	window,
	document: runtimeDocument,
	URL,
	Promise,
	Map,
	Set,
	Number,
	String,
	Error,
	setTimeout,
	clearTimeout,
	decodeURIComponent,
};
vm.runInNewContext(source, runtimeContext);
const initialRuntime = window.blogStats;
const initialListenerCalls = runtimeDocument.addCalls;
vm.runInNewContext(source, runtimeContext);
assert.equal(
	window.blogStats,
	initialRuntime,
	"runtime execution must be idempotent",
);
assert.equal(
	runtimeDocument.addCalls,
	initialListenerCalls,
	"runtime re-execution must not register duplicate lifecycle listeners",
);

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
	enabled: true,
	baseUrl: "https://gateway-us.umami.is",
	shareId: "share-id",
	timezone: "Asia/Shanghai",
	concurrency: 2,
	retryDelays: [],
	requestTimeout: 100,
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
for (const root of roots) {
	assert.equal(
		root.hidden,
		false,
		"valid stats must reveal the complete group",
	);
	assert.equal(root.attributes.get("aria-hidden"), "false");
}
assert.equal(runtimeDocument.documentElement.dataset.siteStatsState, "ready");

window.blogStats.reset();
let failureCalls = 0;
window.blogStats.configure({
	retryDelays: [0, 0],
	fetchStats: async () => {
		failureCalls += 1;
		throw new Error("network");
	},
});
const failed = new StatsRoot("site");
await window.blogStats.initialize(new StatsDocument([failed]));
assert.equal(
	failureCalls,
	3,
	"initial request plus two finite retries expected",
);
assert.equal(failed.dataset.statsState, "error");
assert.equal(failed.hidden, true);
assert.equal(failed.attributes.get("aria-hidden"), "true");
assert.equal(runtimeDocument.documentElement.dataset.siteStatsState, "error");
assert.deepEqual(
	failed.values.map((node) => node.textContent),
	["", ""],
	"blocked requests must not leave zero or dash placeholders",
);

window.blogStats.configure({
	retryDelays: [],
	fetchStats: async () => ({ pageviews: 9, visitors: 3 }),
});
await window.blogStats.initialize(new StatsDocument([failed]));
assert.equal(
	failed.dataset.statsState,
	"ready",
	"a later successful retry must restore a failed root",
);
assert.equal(failed.hidden, false);
assert.deepEqual(
	failed.values.map((node) => node.textContent),
	["9", "3"],
);
assert.equal(runtimeDocument.documentElement.dataset.siteStatsState, "ready");

for (const [index, response] of [
	{ pageviews: null, visitors: 1 },
	{ pageviews: Number.NaN, visitors: 1 },
	{ pageviews: 1, visitors: -1 },
	{ pageviews: 1 },
].entries()) {
	window.blogStats.reset();
	window.blogStats.configure({
		retryDelays: [],
		fetchStats: async () => response,
	});
	const invalid = new StatsRoot("post", `/posts/invalid-${index}/`);
	await window.blogStats.initialize(new StatsDocument([invalid]));
	assert.equal(invalid.dataset.statsState, "error");
	assert.equal(invalid.hidden, true);
	assert.deepEqual(
		invalid.values.map((node) => node.textContent),
		["", ""],
	);
}

window.blogStats.reset();
window.blogStats.configure({
	retryDelays: [],
	fetchStats: async () => ({ pageviews: 3, visitors: 2 }),
});
const missingNode = new StatsRoot("post", "/posts/missing-node/");
missingNode.values.pop();
await window.blogStats.initialize(new StatsDocument([missingNode]));
assert.equal(missingNode.dataset.statsState, "error");
assert.equal(missingNode.hidden, true);

window.blogStats.reset();
window.blogStats.configure({
	retryDelays: [],
	requestTimeout: 5,
	fetchStats: async () => new Promise(() => {}),
});
const timedOut = new StatsRoot("post", "/posts/timeout/");
await window.blogStats.initialize(new StatsDocument([timedOut]));
assert.equal(timedOut.dataset.statsState, "error");
assert.equal(timedOut.hidden, true);

const shellSource = fs.readFileSync(
	new URL("../src/arcade/layouts/ArcadeShell.astro", import.meta.url),
	"utf8",
);
const systemBarSource = fs.readFileSync(
	new URL("../src/arcade/components/SystemBar.astro", import.meta.url),
	"utf8",
);
const postStatsSource = fs.readFileSync(
	new URL("../src/arcade/components/PostStats.astro", import.meta.url),
	"utf8",
);
for (const componentSource of [systemBarSource, postStatsSource]) {
	assert.match(componentSource, /data-blog-stats/);
	assert.match(componentSource, /\bhidden\b/);
	assert.match(componentSource, /aria-hidden="true"/);
	assert.doesNotMatch(componentSource, />--</);
}
assert.ok(
	shellSource.indexOf("window.__BLOG_STATS_CONFIG__") <
		shellSource.indexOf("/js/umami-share.js") &&
		shellSource.indexOf("/js/umami-share.js") <
			shellSource.indexOf("/js/blog-stats.js"),
	"stats configuration and scripts must execute in dependency order",
);
for (const sourcePath of [
	"/js/umami-share.js",
	"/js/blog-stats.js",
	"/js/blog-background.js",
]) {
	const escapedPath = sourcePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	assert.match(
		shellSource,
		new RegExp(`<script defer src="${escapedPath}" data-swup-ignore-script>`),
	);
}

console.log("Stats runtime tests passed");
