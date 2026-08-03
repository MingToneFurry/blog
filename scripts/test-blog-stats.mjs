import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const runtimeSource = fs.readFileSync(
	new URL("../public/js/blog-stats.js", import.meta.url),
	"utf8",
);
const layoutSource = fs.readFileSync(
	new URL("../src/layouts/Layout.astro", import.meta.url),
	"utf8",
);
const profileSource = fs.readFileSync(
	new URL("../src/components/widget/Profile.astro", import.meta.url),
	"utf8",
);
const postMetaSource = fs.readFileSync(
	new URL("../src/components/PostMeta.astro", import.meta.url),
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

const window = { __BLOG_STATS_CONFIG__: { enabled: false } };
const runtimeDocument = new StatsDocument([]);
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
vm.runInNewContext(runtimeSource, runtimeContext);
const initialRuntime = window.blogStats;
const initialListenerCalls = runtimeDocument.addCalls;
vm.runInNewContext(runtimeSource, runtimeContext);
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

assert.ok(maximumActive <= 2);
assert.equal(calls.length, 4, "duplicate paths must share one request");
assert.deepEqual(
	roots[0].values.map((node) => node.textContent),
	["42", "7"],
);
assert.deepEqual(
	roots[4].values.map((node) => node.textContent),
	["0", "0"],
);
for (const root of roots) {
	assert.equal(root.dataset.statsState, "ready");
	assert.equal(
		root.hidden,
		false,
		"valid stats must reveal the complete group",
	);
	assert.equal(root.attributes.get("aria-hidden"), "false");
}

window.blogStats.reset();
let failureCalls = 0;
window.blogStats.configure({
	retryDelays: [0, 0],
	fetchStats: async () => {
		failureCalls += 1;
		throw new Error("blocked");
	},
});
const blocked = new StatsRoot("post", "/posts/blocked/");
await window.blogStats.initialize(new StatsDocument([blocked]));
assert.equal(failureCalls, 3);
assert.equal(blocked.dataset.statsState, "error");
assert.equal(blocked.hidden, true);
assert.equal(blocked.attributes.get("aria-hidden"), "true");
assert.deepEqual(
	blocked.values.map((node) => node.textContent),
	["", ""],
	"blocked requests must not leave zero or dash placeholders",
);

window.blogStats.configure({
	retryDelays: [],
	fetchStats: async () => ({ pageviews: 88, visitors: 12 }),
});
await window.blogStats.initialize(new StatsDocument([blocked]));
assert.equal(blocked.dataset.statsState, "ready");
assert.equal(
	blocked.hidden,
	false,
	"a later successful navigation may recover",
);
assert.deepEqual(
	blocked.values.map((node) => node.textContent),
	["88", "12"],
);

window.blogStats.reset();
window.blogStats.configure({
	retryDelays: [],
	fetchStats: async () => ({ pageviews: null, visitors: -1 }),
});
const invalid = new StatsRoot("post", "/posts/invalid/");
await window.blogStats.initialize(new StatsDocument([invalid]));
assert.equal(invalid.dataset.statsState, "error");
assert.equal(invalid.hidden, true);
assert.deepEqual(
	invalid.values.map((node) => node.textContent),
	["", ""],
);

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

for (const source of [profileSource, postMetaSource]) {
	assert.match(source, /data-blog-stats/);
	assert.match(source, /\bhidden\b/);
}
assert.match(profileSource, /data-stats-state="idle"/);
assert.match(profileSource, /aria-hidden="true"/);
assert.match(postMetaSource, /"data-stats-state": "idle"/);
assert.match(postMetaSource, /"aria-hidden": "true"/);
assert.match(postMetaSource, /const statsOnly =/);
assert.match(
	postMetaSource,
	/\{\.\.\.\(statsOnly \? statsRootAttributes : \{\}\)\}/,
	"a stats-only PostMeta root must collapse its outer margin when hidden",
);
assert.match(
	layoutSource,
	/\[data-blog-stats\]:not\(\[data-stats-state="ready"\]\)/,
);
assert.ok(
	layoutSource.indexOf("/js/umami-share.js") <
		layoutSource.indexOf("/js/blog-stats.js"),
	"the share helper must execute before the stats renderer",
);
assert.match(
	layoutSource,
	/<script defer src="\/js\/umami-share\.js" data-swup-ignore-script>/,
);
assert.match(
	layoutSource,
	/<script defer src="\/js\/blog-stats\.js" data-swup-ignore-script>/,
);

console.log("Blog stats fail-closed tests passed");
