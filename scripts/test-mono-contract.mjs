import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const journalCssPath = path.join(root, "src/styles/mono/journal.css");
const journalCss = fs.readFileSync(journalCssPath, "utf8");
const journalRuntimePath = path.join(root, "src/mono/runtime/journal.ts");
const journalRuntime = fs.readFileSync(journalRuntimePath, "utf8");
const astroConfig = fs.readFileSync(path.join(root, "astro.config.mjs"), "utf8");

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

function collectFiles(directory, extension) {
	const files = [];
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...collectFiles(fullPath, extension));
		else if (entry.name.endsWith(extension)) files.push(fullPath);
	}
	return files;
}

assert(fs.existsSync(dist), "dist/ is missing; run pnpm build before test:mono-contract");
const htmlFiles = collectFiles(dist, ".html");
assert(htmlFiles.length === 36, `expected 36 generated HTML pages, received ${htmlFiles.length}`);

for (const htmlFile of htmlFiles) {
	const relative = path.relative(dist, htmlFile).replaceAll("\\", "/");
	const document = parse(fs.readFileSync(htmlFile, "utf8"));
	assert(document.querySelectorAll("main").length === 1, `${relative}: expected one main element`);
	assert(document.querySelectorAll("#toc").length === 1, `${relative}: expected one #toc element`);
	assert(document.querySelectorAll("[data-journal-mobile-menu]").length === 1, `${relative}: expected one mobile menu`);
	assert(!document.querySelector("#main-grid, #sidebar-sticky, .post-card, .card-base"), `${relative}: legacy Fuwari markup leaked into output`);

	const stage = document.querySelector("[data-journal-stage]");
	const main = document.querySelector("#journal-main");
	const background = document.querySelector("[data-blog-background]");
	const backgroundMode = main?.getAttribute("data-journal-background-mode");
	assert(stage && main && background, `${relative}: persistent journal stage is incomplete`);
	assert(background.parentNode === stage, `${relative}: background must remain outside Swup containers`);
	assert(!main.querySelector("[data-blog-background]"), `${relative}: main must not own the persistent background`);
	assert(backgroundMode === "cover" || backgroundMode === "edge", `${relative}: invalid background mode`);
	assert(stage.getAttribute("data-journal-background-mode") === backgroundMode, `${relative}: stage and main background modes differ`);

	for (const rootNode of document.querySelectorAll("[data-blog-stats]")) {
		const pageviews = rootNode.querySelector('[data-stats-value="pageviews"]');
		const visitors = rootNode.querySelector('[data-stats-value="visitors"]');
		assert(pageviews?.text.trim() === "--", `${relative}: pageviews must start at --`);
		assert(visitors?.text.trim() === "--", `${relative}: visitors must start at --`);
	}

	for (const link of document.querySelectorAll('a[target="_blank"]')) {
		const rel = new Set((link.getAttribute("rel") || "").split(/\s+/).filter(Boolean));
		assert(rel.has("noopener") && rel.has("noreferrer"), `${relative}: target=_blank link is missing noopener noreferrer`);
	}

	for (const button of document.querySelectorAll("button")) {
		const accessibleName = button.getAttribute("aria-label") || button.text.trim();
		assert(Boolean(accessibleName), `${relative}: button is missing an accessible name`);
	}
}

for (const [pageNumber, expectedPosts] of [[1, 8], [2, 8], [3, 8], [4, 2]]) {
	const homePath = pageNumber === 1
		? path.join(dist, "index.html")
		: path.join(dist, String(pageNumber), "index.html");
	const home = parse(fs.readFileSync(homePath, "utf8"));
	assert(home.querySelectorAll('[data-stats-scope="site"]').length === 1, `page ${pageNumber}: expected one site stats root`);
	assert(home.querySelectorAll('[data-stats-scope="post"]').length === expectedPosts, `page ${pageNumber}: expected ${expectedPosts} post stats roots`);
}

const routeSources = collectFiles(path.join(root, "src/pages"), ".astro")
	.concat(collectFiles(path.join(root, "src/pages"), ".md"));
const legacyPattern = /MainGridLayout|@layouts\/Layout|PostCard|PostMeta|PostPage|Profile\.astro|SideBar|Navbar/;
for (const sourcePath of routeSources) {
	assert(!legacyPattern.test(fs.readFileSync(sourcePath, "utf8")), `${path.relative(root, sourcePath)} still consumes legacy visual structure`);
}

assert(!/\b(?:linear|radial|conic)-gradient\s*\(/i.test(journalCss), "Journal CSS must not use gradients");
assert(!/backdrop-filter\s*:/i.test(journalCss), "Journal CSS must not use backdrop blur");
assert(!/filter\s*:\s*blur\s*\(/i.test(journalCss), "Journal CSS must not use blur filters");
const radii = [...journalCss.matchAll(/border-radius\s*:\s*([^;]+);/gi)]
	.map((match) => match[1].trim());
assert(radii.every((value) => /^0(?:px)?(?:\s*!important)?$/i.test(value)), "Journal CSS must keep zero radius");
assert(!/border(?:-width)?\s*:\s*[2-9]px/i.test(journalCss), "Journal CSS borders must stay at 1px");
assert(journalCss.includes("@media (prefers-reduced-motion: reduce)"), "Journal CSS must include reduced-motion rules");
assert(journalCss.includes("@media (max-width: 39rem)"), "Journal CSS must include the 390px mobile breakpoint");
assert(journalRuntime.includes('event.key === "Escape"'), "Journal runtime must handle the Escape key explicitly");
assert(journalRuntime.includes('querySelector<HTMLDialogElement>("dialog[open]")'), "Journal runtime must find the open dialog on Escape");
assert(journalRuntime.includes("closeDialog(dialog)"), "Journal runtime must close dialogs through the focus-restoring helper");
assert(journalRuntime.includes("function closeMobileMenu"), "Journal runtime must close the mobile menu explicitly");
assert(journalRuntime.includes("mobileSummary || trigger"), "Mobile dialogs must restore focus to the visible menu summary");
assert(journalRuntime.includes("function trapDialogFocus"), "Journal dialogs must explicitly trap keyboard focus");
assert(journalRuntime.includes('event.key === "Tab"'), "Journal runtime must handle dialog Tab boundaries");
assert(journalRuntime.includes("function syncBackgroundMode"), "Journal runtime must synchronize the persistent background mode");
assert(journalRuntime.includes("journalDialogOpen"), "Journal runtime must expose dialog scroll-lock state");
assert(journalRuntime.includes("link.click()"), "Article keyboard navigation must stay inside Swup");
assert(!journalRuntime.includes("window.location.href = link.href"), "Article keyboard navigation must not hard reload the page");
assert(journalCss.includes('html[data-journal-dialog-open="true"]'), "Journal CSS must lock page scrolling behind dialogs");
assert(journalCss.includes(".journal-mobile-menu[open]"), "Journal CSS must include the mobile menu open state");
assert(astroConfig.includes('containers: ["main", "#toc"]'), "Swup containers must leave the persistent background untouched");

const nonNoneShadows = [...journalCss.matchAll(/box-shadow\s*:\s*([^;]+);/gi)]
	.map((match) => match[1].trim())
	.filter((value) => value !== "none" && value !== "none !important");
assert(nonNoneShadows.length === 1, "only the dialog may use one environmental shadow");

console.log(`MONO contract tests passed (${htmlFiles.length} HTML pages).`);
