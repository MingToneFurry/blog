import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "node-html-parser";

async function collectFiles(directory, predicate) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const absolute = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...await collectFiles(absolute, predicate));
		else if (predicate(absolute)) files.push(absolute);
	}
	return files;
}

async function assertDirectoryHasNoFiles(directory) {
	try {
		const files = await collectFiles(directory, () => true);
		assert.equal(files.length, 0, `${directory} must not contain retired source files`);
	} catch (error) {
		if (error?.code !== "ENOENT") throw error;
	}
}

const htmlFiles = await collectFiles("dist", (file) => file.endsWith(".html"));
assert.equal(htmlFiles.length, 36, "ARCADE build must keep the 36-page HTML baseline");

for (const retiredDirectory of ["src/components", "src/layouts"]) {
	await assertDirectoryHasNoFiles(retiredDirectory);
}

for (const retiredFile of [
	"src/styles/arcade.css",
	"src/styles/expressive-code.css",
	"src/styles/main.css",
	"src/styles/markdown-extend.styl",
	"src/styles/markdown.css",
	"src/styles/scrollbar.css",
	"src/styles/transition.css",
	"src/styles/variables.styl",
	"src/utils/setting-utils.ts",
]) {
	await assert.rejects(access(retiredFile), `${retiredFile} must remain retired`);
}

for (const file of htmlFiles) {
	const source = await readFile(file, "utf8");
	const document = parse(source);
	assert.equal(document.querySelectorAll("main").length, 1, `${file} must contain one main container`);
	assert.equal(document.querySelectorAll("#toc").length, 1, `${file} must contain one #toc container`);
	assert.ok(document.querySelector('html[data-product="arcade-field-node"]'), `${file} must use ArcadeShell`);
	assert.ok(document.querySelector("[data-blog-background] [data-background-image]"), `${file} must expose the background protocol`);
	assert.equal(document.querySelectorAll('script[src="/js/umami-share.js"]').length, 1, `${file} must load one Umami helper`);
	assert.equal(document.querySelectorAll('script[src="/js/blog-stats.js"]').length, 1, `${file} must load one stats runtime`);
	assert.equal(document.querySelectorAll('script[src="/js/blog-background.js"]').length, 1, `${file} must load one background runtime`);
	assert.doesNotMatch(source, /fetchPostStats|loadPostCardStats|statsLoaded|post-pageviews/, `${file} contains a legacy stats consumer`);
	assert.doesNotMatch(
		source,
		/\/_astro\/(?:Layout\.|Search\.|DisplaySettings\.|setting-utils\.)/,
		`${file} still references a retired Fuwari asset`,
	);

	for (const statsRoot of document.querySelectorAll("[data-blog-stats]")) {
		assert.equal(statsRoot.getAttribute("data-stats-state"), "idle", `${file} stats root must start idle`);
		const pageviews = statsRoot.querySelectorAll('[data-stats-value="pageviews"]');
		const visitors = statsRoot.querySelectorAll('[data-stats-value="visitors"]');
		assert.equal(pageviews.length, 1, `${file} stats root must expose PV`);
		assert.equal(visitors.length, 1, `${file} stats root must expose UV`);
		for (const value of [...pageviews, ...visitors]) {
			assert.equal(value.text.trim(), "--", `${file} stats placeholders must be --`);
		}
	}

	for (const link of document.querySelectorAll('a[target="_blank"]')) {
		const rel = link.getAttribute("rel") || "";
		assert.match(rel, /noopener/, `${file} external blank link must use noopener`);
	}

	for (const button of document.querySelectorAll("button")) {
		const accessibleName = button.getAttribute("aria-label") || button.text.trim();
		assert.ok(accessibleName, `${file} contains an unnamed button`);
	}
}

const emittedAssets = await collectFiles(path.join("dist", "_astro"), (file) => /\.(?:css|js)$/.test(file));
const emittedAssetNames = emittedAssets.map((file) => path.basename(file)).join("\n");
assert.doesNotMatch(
	emittedAssetNames,
	/^(?:Layout\.|Search\.|DisplaySettings\.|setting-utils\.)/m,
	"ARCADE must not emit retired Fuwari bundles",
);
const emittedAssetText = (await Promise.all(emittedAssets.map((file) => readFile(file, "utf8")))).join("\n");
assert.doesNotMatch(
	emittedAssetText,
	/fancybox__|OverlayScrollbars|data-overlayscrollbars/,
	"ARCADE output must not contain retired Fancybox or OverlayScrollbars UI",
);

const homeDocument = parse(await readFile(path.join("dist", "index.html"), "utf8"));
assert.equal(homeDocument.querySelectorAll('[data-stats-scope="post"]').length, 8, "homepage must expose PV+UV roots for all 8 posts");
assert.equal(homeDocument.querySelectorAll('[data-stats-scope="site"]').length, 1, "homepage must expose site lifetime stats");

for (const pageNumber of [2, 3, 4]) {
	const pageDocument = parse(await readFile(path.join("dist", String(pageNumber), "index.html"), "utf8"));
	assert.ok(pageDocument.querySelectorAll('[data-stats-scope="post"]').length > 0, `page ${pageNumber} must expose post stats`);
}

const articleFiles = htmlFiles.filter((file) => file.includes(`${path.sep}posts${path.sep}`));
assert.ok(articleFiles.length > 0, "article output is missing");
for (const file of articleFiles) {
	const document = parse(await readFile(file, "utf8"));
	assert.equal(document.querySelectorAll('[data-stats-scope="post"]').length, 1, `${file} must expose one article stats root`);
	assert.ok(document.querySelector("[data-article-body]"), `${file} must expose the reader body`);
	assert.ok(document.querySelector("#toc .arcade-toc"), `${file} must expose the article TOC`);
	assert.ok(document.querySelector("[data-giscus-host]"), `${file} must preserve Giscus`);
	assert.ok(document.querySelector('a[rel*="license"]'), `${file} must preserve License`);
}

const implementationFiles = await collectFiles("src", (file) => /\.(astro|md|ts|css)$/.test(file));
const routedSources = implementationFiles.filter((file) => file.includes(`${path.sep}pages${path.sep}`) || file.includes(`${path.sep}arcade${path.sep}`));
const routedText = (await Promise.all(routedSources.map((file) => readFile(file, "utf8")))).join("\n");
assert.doesNotMatch(routedText, /MainGridLayout|layouts\/Layout|components\/Navbar|components\/PostCard|components\/PostMeta|components\/widget\/Profile|components\/widget\/SideBar|NavMenuPanel/, "routes still reference the Fuwari visual tree");
assert.doesNotMatch(routedText, /fetchUmamiStats|fetchPostStats|loadPostStats|loadPostCardStats|post-pageviews/, "routes still contain a competing stats consumer");

const arcadeCss = await readFile(path.join("src", "styles", "arcade", "index.css"), "utf8");
assert.match(arcadeCss, /border-radius:\s*0\s*!important/, "ARCADE must globally enforce square corners");
assert.match(arcadeCss, /@media \(prefers-reduced-motion: reduce\)/, "ARCADE must include reduced-motion fallbacks");
assert.match(arcadeCss, /@media \(max-width: 400px\)/, "ARCADE must include a 390px-safe breakpoint");
const mobileTelemetryBlock = arcadeCss.match(/@media \(max-width: 980px\) \{([\s\S]*?)@media \(max-width: 820px\)/)?.[1] ?? "";
assert.match(mobileTelemetryBlock, /\.arcade-site-telemetry\s*\{[\s\S]*?position:\s*absolute/, "ARCADE must keep lifetime telemetry visible below the compact system bar");
assert.doesNotMatch(arcadeCss, /\.arcade-site-telemetry\s*\{[^}]*display:\s*none/, "ARCADE must not hide lifetime telemetry at any responsive breakpoint");

console.log(`ARCADE contract tests passed (${htmlFiles.length} HTML pages, ${articleFiles.length} articles)`);
