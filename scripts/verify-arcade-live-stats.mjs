import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { parse } from "node-html-parser";

const BASE_URL = "https://gateway-us.umami.is";
const SHARE_ID = "HdVBrs2TcRJ2LJd4";
const TIMEZONE = "Asia/Shanghai";
const helperSource = await readFile("public/js/umami-share.js", "utf8");
const homeDocument = parse(await readFile("dist/index.html", "utf8"));
const renderedPostPaths = homeDocument
	.querySelectorAll('[data-stats-scope="post"]')
	.map((node) => node.getAttribute("data-stats-path"))
	.filter(Boolean);
const postPaths = [...new Set(renderedPostPaths)];

assert.ok(
	postPaths.length > 0,
	"live verification expects homepage post paths",
);
assert.equal(
	postPaths.length,
	renderedPostPaths.length,
	"homepage statistics paths must be unique across pinned and paginated posts",
);

function createMemoryStorage() {
	const values = new Map([["umami-share-cache:legacy", "must-be-purged"]]);
	return {
		get length() {
			return values.size;
		},
		key(index) {
			return [...values.keys()][index] ?? null;
		},
		getItem(key) {
			return values.get(key) ?? null;
		},
		setItem(key, value) {
			values.set(key, String(value));
		},
		removeItem(key) {
			values.delete(key);
		},
	};
}

function getNumericValue(value) {
	const candidate = value && typeof value === "object" ? value.value : value;
	return typeof candidate === "number" &&
		Number.isFinite(candidate) &&
		candidate >= 0
		? candidate
		: null;
}

async function createHelperWindow() {
	const storage = createMemoryStorage();
	const sandbox = {
		window: null,
		localStorage: storage,
		Map,
		Set,
		URL,
		URLSearchParams,
		Date,
		fetch: (input, init = {}) =>
			fetch(input, {
				...init,
				signal: AbortSignal.timeout(20_000),
			}),
	};
	sandbox.window = sandbox;
	vm.runInNewContext(helperSource, sandbox, { filename: "umami-share.js" });
	assert.equal(
		storage.getItem("umami-share-cache:legacy"),
		null,
		"legacy share cache must be purged",
	);
	return sandbox;
}

async function withRetry(task) {
	let lastError;
	for (const delay of [0, 250, 750]) {
		if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
		try {
			return await task();
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError;
}

async function verifyRound(round) {
	const helper = await createHelperWindow();
	const targets = [null, ...postPaths];
	const results = new Array(targets.length);
	let cursor = 0;

	async function worker() {
		while (cursor < targets.length) {
			const index = cursor;
			cursor += 1;
			const postPath = targets[index];
			try {
				const stats = await withRetry(() =>
					helper.fetchUmamiStats(BASE_URL, SHARE_ID, {
						timezone: TIMEZONE,
						...(postPath ? { url: postPath } : {}),
					}),
				);
				assert.notEqual(
					getNumericValue(stats.pageviews),
					null,
					`${postPath || "site"} PV missing`,
				);
				assert.notEqual(
					getNumericValue(stats.visitors),
					null,
					`${postPath || "site"} UV missing`,
				);
				results[index] = { ok: true, path: postPath || "site" };
			} catch (error) {
				results[index] = { ok: false, path: postPath || "site", error };
			}
		}
	}

	await Promise.all(Array.from({ length: 4 }, () => worker()));
	const failures = results.filter((result) => !result.ok);
	console.log(
		`round ${round}: ${results.length - failures.length}/${results.length} cumulative PV+UV targets ready`,
	);
	if (failures.length > 0) {
		console.error(
			`failed paths: ${failures.map((failure) => failure.path).join(", ")}`,
		);
		throw failures[0].error;
	}
}

for (let round = 1; round <= 3; round += 1) await verifyRound(round);
console.log(
	"ARCADE live Umami verification passed without persisting or printing the share token",
);
