import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const astroCli = fileURLToPath(
	new URL("../node_modules/astro/astro.js", import.meta.url),
);

async function reservePort() {
	const socket = createServer();
	socket.unref();
	await new Promise((resolve, reject) => {
		socket.once("error", reject);
		socket.listen(0, "127.0.0.1", resolve);
	});
	const address = socket.address();
	assert.ok(
		address && typeof address !== "string",
		"preview server did not reserve a TCP port",
	);
	const port = address.port;
	await new Promise((resolve, reject) =>
		socket.close((error) => (error ? reject(error) : resolve())),
	);
	return port;
}

async function waitForPreview(url, process, output) {
	for (let attempt = 0; attempt < 80; attempt += 1) {
		if (process.exitCode !== null) {
			throw new Error(
				`Astro preview exited with ${process.exitCode}\n${output.join("")}`,
			);
		}
		try {
			const response = await fetch(url);
			if (response.ok) return;
		} catch {}
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	throw new Error(
		`Astro preview did not become ready at ${url}\n${output.join("")}`,
	);
}

async function assertNoHorizontalOverflow(page, label) {
	const dimensions = await page.evaluate(() => ({
		viewport: window.innerWidth,
		document: document.documentElement.scrollWidth,
		body: document.body.scrollWidth,
	}));
	assert.ok(
		dimensions.document <= dimensions.viewport,
		`${label} document overflows horizontally: ${JSON.stringify(dimensions)}`,
	);
	assert.ok(
		dimensions.body <= dimensions.viewport,
		`${label} body overflows horizontally: ${JSON.stringify(dimensions)}`,
	);
}

async function routeState(page) {
	return page.evaluate(() => ({
		path: location.pathname,
		main: document.querySelectorAll("#glass-main").length,
		toc: document.querySelectorAll("#toc").length,
		openDialogs: document.querySelectorAll("dialog[open]").length,
		openMobileMenus: document.querySelectorAll(".glass-mobile-menu[open]")
			.length,
		backgroundState: document
			.querySelector("[data-blog-background]")
			?.getAttribute("data-background-state"),
		backgroundSource:
			document.querySelector("[data-background-image]")?.currentSrc || "",
	}));
}

async function runDesktop(baseUrl, browser) {
	const context = await browser.newContext({
		viewport: { width: 1440, height: 1000 },
		reducedMotion: "reduce",
	});
	const page = await context.newPage();
	const pageErrors = [];
	page.on("pageerror", (error) => pageErrors.push(error.message));

	await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
	await assertNoHorizontalOverflow(page, "desktop home");

	const searchTrigger = page.locator(
		'[data-glass-dialog-open="glass-search-dialog"]',
	);
	await searchTrigger.locator("svg").click();
	await page.locator("#glass-search-input").fill("cloudflare");
	await page.waitForFunction(
		() => document.querySelectorAll("#glass-search-results a").length > 0,
	);
	assert.match(
		await page.locator("#glass-search-status").innerText(),
		/找到 \d+ 条观测记录/,
	);
	await page
		.locator("#glass-search-dialog [data-glass-dialog-close] svg")
		.click();
	assert.equal(
		await page.locator("#glass-search-dialog").getAttribute("open"),
		null,
	);
	assert.equal(
		await page.evaluate(() =>
			document.activeElement?.getAttribute("aria-label"),
		),
		"搜索文章",
	);

	await searchTrigger.locator("svg").click();
	await page.keyboard.press("Escape");
	assert.equal(
		await page.locator("#glass-search-dialog").getAttribute("open"),
		null,
	);
	assert.equal(
		await page.evaluate(() =>
			document.activeElement?.getAttribute("aria-label"),
		),
		"搜索文章",
	);

	const settingsTrigger = page.locator(
		'[data-glass-dialog-open="glass-settings-dialog"]',
	);
	await settingsTrigger.locator("svg").click();
	await page.locator('[data-glass-theme="dark"]').click();
	await page.locator("#glass-background-visible").uncheck();
	await page.locator("#glass-background-blur").fill("17");
	await page
		.locator("#glass-settings-dialog [data-glass-dialog-close] svg")
		.click();
	await page.reload({ waitUntil: "domcontentloaded" });
	assert.deepEqual(
		await page.evaluate(() => ({
			theme: document.documentElement.dataset.themePreference,
			visible: document.querySelector("#glass-background-visible")?.checked,
			blur: document.querySelector("#glass-background-blur")?.value,
			background: document
				.querySelector("[data-blog-background]")
				?.getAttribute("data-background-state"),
		})),
		{ theme: "dark", visible: false, blur: "17", background: "disabled" },
	);

	await settingsTrigger.locator("svg").click();
	await page.locator('[data-glass-theme="auto"]').click();
	await page.locator("#glass-background-visible").check();
	await page.locator("#glass-background-blur").fill("4");
	await page.waitForFunction(
		() =>
			document
				.querySelector("[data-blog-background]")
				?.getAttribute("data-background-state") === "ready",
	);
	await page
		.locator("#glass-settings-dialog [data-glass-dialog-close] svg")
		.click();

	await page.evaluate(() => {
		window.__glassTestBackground = document.querySelector(
			"[data-blog-background]",
		);
		window.__glassTestBackgroundImage = document.querySelector(
			"[data-background-image]",
		);
		window.__glassTestLoads = 0;
		window.__glassTestBackgroundImage?.addEventListener("load", () => {
			window.__glassTestLoads += 1;
		});
	});
	await page.locator('.glass-pagination a[aria-label="第 2 页"]').click();
	await page.waitForURL(/\/2\/$/);
	assert.deepEqual(
		await page.evaluate(() => ({
			sameRoot:
				window.__glassTestBackground ===
				document.querySelector("[data-blog-background]"),
			sameImage:
				window.__glassTestBackgroundImage ===
				document.querySelector("[data-background-image]"),
			loads: window.__glassTestLoads,
		})),
		{ sameRoot: true, sameImage: true, loads: 0 },
	);
	assert.deepEqual(await routeState(page), {
		path: "/2/",
		main: 1,
		toc: 1,
		openDialogs: 0,
		openMobileMenus: 0,
		backgroundState: "ready",
		backgroundSource: "https://api.furry.ist/furry-img",
	});
	await assertNoHorizontalOverflow(page, "desktop pagination");

	await context.close();
	assert.deepEqual(
		pageErrors,
		[],
		`desktop page errors: ${pageErrors.join("\n")}`,
	);
}

async function runMobile(baseUrl, browser) {
	const context = await browser.newContext({
		viewport: { width: 390, height: 844 },
		reducedMotion: "reduce",
	});
	const page = await context.newPage();
	const pageErrors = [];
	page.on("pageerror", (error) => pageErrors.push(error.message));

	await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
	await assertNoHorizontalOverflow(page, "mobile home");
	const menu = page.locator(".glass-mobile-menu");
	const summary = menu.locator(":scope > summary");
	await summary.locator("svg").click();
	assert.notEqual(await menu.getAttribute("open"), null);
	await page.waitForFunction(
		() => document.activeElement?.getAttribute("aria-label") === "关闭导航",
	);
	assert.equal(
		await page.evaluate(() =>
			document.activeElement?.getAttribute("aria-label"),
		),
		"关闭导航",
	);
	await page.keyboard.press("Shift+Tab");
	assert.equal(
		(await page.evaluate(() => document.activeElement?.textContent))?.trim(),
		"隐私",
	);
	await page.keyboard.press("Tab");
	assert.equal(
		await page.evaluate(() =>
			document.activeElement?.getAttribute("aria-label"),
		),
		"关闭导航",
	);

	const drawer = page.locator(".glass-mobile-drawer");
	const drawerBox = await drawer.boundingBox();
	assert.ok(
		drawerBox && drawerBox.x > 0,
		"mobile navigation must leave a real backdrop click target",
	);
	await page.mouse.click(Math.max(1, drawerBox.x / 2), 400);
	assert.equal(
		await menu.getAttribute("open"),
		null,
		"mobile backdrop must close navigation",
	);
	assert.equal(
		await page.evaluate(() =>
			document.activeElement?.getAttribute("aria-label"),
		),
		"打开导航",
	);

	await page.locator('.glass-pagination a[aria-label="第 2 页"]').click();
	await page.waitForURL(/\/2\/$/);
	await page.waitForTimeout(250);
	await summary.locator("svg").click();
	assert.notEqual(await menu.getAttribute("open"), null);
	await page.goBack({ waitUntil: "domcontentloaded" });
	await page.waitForURL(new URL("/", baseUrl).href);
	await page.waitForTimeout(250);
	assert.equal(
		await menu.getAttribute("open"),
		null,
		"history navigation must clear a stale global drawer",
	);
	assert.deepEqual((await routeState(page)).openDialogs, 0);

	await page
		.locator('[data-glass-dialog-open="glass-search-dialog"] svg')
		.click();
	assert.notEqual(
		await page.locator("#glass-search-dialog").getAttribute("open"),
		null,
	);
	await page.goForward({ waitUntil: "domcontentloaded" });
	await page.waitForURL(/\/2\/$/);
	await page.waitForTimeout(250);
	assert.equal(
		await page.locator("#glass-search-dialog").getAttribute("open"),
		null,
		"history navigation must clear a stale native dialog",
	);
	await page.goBack({ waitUntil: "domcontentloaded" });
	await page.waitForURL(new URL("/", baseUrl).href);
	await page.waitForTimeout(250);

	const longArticle = page
		.locator('a[href*="cloudflare"][href^="/posts/"]')
		.last();
	await longArticle.click();
	await page.waitForURL(/\/posts\//);
	const contextDrawer = page.locator("[data-glass-context-drawer]");
	await contextDrawer.locator(":scope > summary svg").click();
	assert.notEqual(await contextDrawer.getAttribute("open"), null);
	const contextPanelBox = await contextDrawer
		.locator("[data-glass-drawer-panel]")
		.boundingBox();
	assert.ok(
		contextPanelBox && contextPanelBox.y > 0,
		"mobile context drawer must leave an outside-click area",
	);
	await page.mouse.click(10, Math.max(1, contextPanelBox.y / 2));
	assert.equal(await contextDrawer.getAttribute("open"), null);
	assert.match(
		await page.evaluate(
			() => document.activeElement?.getAttribute("aria-label") || "",
		),
		/^打开/,
	);
	await assertNoHorizontalOverflow(page, "mobile article");

	const state = await routeState(page);
	assert.equal(state.main, 1);
	assert.equal(state.toc, 1);
	assert.equal(state.backgroundState, "ready");
	assert.equal(state.backgroundSource, "https://api.furry.ist/furry-img");

	await context.close();
	assert.deepEqual(
		pageErrors,
		[],
		`mobile page errors: ${pageErrors.join("\n")}`,
	);
}

const port = await reservePort();
const baseUrl = `http://127.0.0.1:${port}/`;
const output = [];
const preview = spawn(
	process.execPath,
	[astroCli, "preview", "--host", "127.0.0.1", "--port", String(port)],
	{
		cwd: projectRoot,
		stdio: ["ignore", "pipe", "pipe"],
		windowsHide: true,
	},
);
preview.stdout.on("data", (chunk) => output.push(chunk.toString()));
preview.stderr.on("data", (chunk) => output.push(chunk.toString()));

let browser;
try {
	await waitForPreview(baseUrl, preview, output);
	browser = await chromium.launch({ headless: true });
	await runDesktop(baseUrl, browser);
	await runMobile(baseUrl, browser);
	console.log(
		"GLASS Playwright interactions passed: desktop 1440x1000 and mobile 390x844.",
	);
} finally {
	await browser?.close();
	if (preview.exitCode === null) {
		preview.kill();
		await Promise.race([
			once(preview, "exit"),
			new Promise((resolve) => setTimeout(resolve, 3000)),
		]);
	}
}
