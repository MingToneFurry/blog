import {
	applyAppearanceAttributes,
	readAppearanceSettings,
	resolveTheme,
	writeAppearanceSettings,
} from "@/utils/settings-core";
import type { AppearanceSettings } from "@/types/runtime";

type ArcadeWindow = Window & { __arcadeRuntimeStarted?: boolean };

type SearchRecord = {
	title: string;
	description: string;
	href: string;
	searchable: string;
};

const pageEvents = [
	"astro:page-load",
	"astro:after-swap",
	"swup:contentReplaced",
	"content:replace",
] as const;

let settings: AppearanceSettings;
let searchIndexPromise: Promise<SearchRecord[]> | null = null;
let commandReturnFocus: HTMLElement | null = null;

function normalizedPath(path: string): string {
	try {
		const parsed = new URL(path, window.location.origin).pathname;
		return parsed === "/" ? "/" : `${parsed.replace(/\/+$/, "")}/`;
	} catch {
		return "/";
	}
}

function getMediaQuery(): MediaQueryList {
	return window.matchMedia("(prefers-color-scheme: dark)");
}

function applySettings(next: AppearanceSettings, persist = false): void {
	settings = persist ? writeAppearanceSettings(window.localStorage, next) : next;
	const root = document.documentElement;
	applyAppearanceAttributes(root, settings, getMediaQuery().matches);
	root.style.colorScheme = resolveTheme(settings.theme, getMediaQuery().matches);

	for (const background of document.querySelectorAll<HTMLElement>("[data-blog-background]")) {
		background.dataset.backgroundVisible = String(settings.backgroundVisible);
		background.style.setProperty("--scene-blur", `${settings.backgroundBlur}px`);
	}

	for (const button of document.querySelectorAll<HTMLButtonElement>("[data-theme-choice]")) {
		button.setAttribute("aria-pressed", String(button.dataset.themeChoice === settings.theme));
	}
	for (const toggle of document.querySelectorAll<HTMLInputElement>("[data-background-toggle]")) {
		toggle.checked = settings.backgroundVisible;
	}
	for (const slider of document.querySelectorAll<HTMLInputElement>("[data-background-blur]")) {
		slider.value = String(settings.backgroundBlur);
	}
	for (const output of document.querySelectorAll<HTMLElement>("[data-background-blur-output]")) {
		output.textContent = `${settings.backgroundBlur} PX`;
	}

	void window.blogBackground?.initialize(document);
	updateGiscusTheme();
}

function updateGiscusTheme(): void {
	const theme = document.documentElement.dataset.colorScheme === "light" ? "light" : "dark";
	const frame = document.querySelector<HTMLIFrameElement>("iframe.giscus-frame");
	frame?.contentWindow?.postMessage({ giscus: { setConfig: { theme } } }, "https://giscus.app");
}

function switchCommandPane(mode: "search" | "settings"): void {
	for (const tab of document.querySelectorAll<HTMLButtonElement>("[data-command-tab]")) {
		const active = tab.dataset.commandTab === mode;
		tab.setAttribute("aria-selected", String(active));
		tab.tabIndex = active ? 0 : -1;
	}
	for (const pane of document.querySelectorAll<HTMLElement>("[data-command-pane]")) {
		pane.hidden = pane.dataset.commandPane !== mode;
	}
}

function openCommand(mode: "search" | "settings", trigger?: HTMLElement): void {
	const layer = document.querySelector<HTMLElement>("[data-command-layer]");
	if (!layer) return;
	commandReturnFocus = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
	switchCommandPane(mode);
	layer.hidden = false;
	layer.setAttribute("aria-hidden", "false");
	document.documentElement.dataset.commandOpen = "true";
	requestAnimationFrame(() => {
		layer.dataset.open = "true";
		const target = mode === "search"
			? layer.querySelector<HTMLInputElement>("[data-command-search]")
			: layer.querySelector<HTMLElement>("[data-command-pane='settings'] button, [data-command-pane='settings'] input");
		target?.focus();
	});
}

function closeCommand(): void {
	const layer = document.querySelector<HTMLElement>("[data-command-layer]");
	if (!layer || layer.hidden) return;
	delete layer.dataset.open;
	layer.setAttribute("aria-hidden", "true");
	delete document.documentElement.dataset.commandOpen;
	window.setTimeout(() => {
		layer.hidden = true;
		commandReturnFocus?.focus();
		commandReturnFocus = null;
	}, 160);
}

function focusableElements(container: HTMLElement): HTMLElement[] {
	return [...container.querySelectorAll<HTMLElement>(
		'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
	)].filter((element) => !element.hidden && element.offsetParent !== null);
}

async function loadSearchIndex(): Promise<SearchRecord[]> {
	if (searchIndexPromise) return searchIndexPromise;
	searchIndexPromise = fetch("/rss.xml", { credentials: "same-origin" })
		.then((response) => {
			if (!response.ok) throw new Error(`RSS HTTP ${response.status}`);
			return response.text();
		})
		.then((source) => {
			const xml = new DOMParser().parseFromString(source, "application/xml");
			if (xml.querySelector("parsererror")) throw new Error("RSS parse failed");
			return [...xml.querySelectorAll("item")].map((item) => {
				const title = item.querySelector("title")?.textContent?.trim() || "未命名任务";
				const description = item.querySelector("description")?.textContent?.trim() || "";
				const rawLink = item.querySelector("link")?.textContent?.trim() || "/archive/";
				const href = new URL(rawLink, window.location.origin).pathname;
				return { title, description, href, searchable: `${title} ${description}`.toLocaleLowerCase() };
			});
		});
	return searchIndexPromise;
}

function renderSearchResults(records: SearchRecord[], query: string): void {
	const container = document.querySelector<HTMLElement>("[data-search-results]");
	const status = document.querySelector<HTMLElement>("[data-search-status]");
	if (!container || !status) return;
	container.replaceChildren();
	if (!query) {
		status.textContent = "输入关键词以扫描 RSS 任务索引。";
		return;
	}
	const matches = records.filter((record) => record.searchable.includes(query)).slice(0, 8);
	status.textContent = matches.length > 0 ? `发现 ${matches.length} 个匹配任务。` : "没有匹配任务，可前往归档继续浏览。";
	for (const [index, record] of matches.entries()) {
		const link = document.createElement("a");
		link.href = record.href;
		link.className = "arcade-search-result cut-tab";
		const number = document.createElement("span");
		number.textContent = String(index + 1).padStart(2, "0");
		const copy = document.createElement("span");
		const title = document.createElement("strong");
		title.textContent = record.title;
		const description = document.createElement("small");
		description.textContent = record.description || "任务简报暂无描述";
		copy.append(title, description);
		const arrow = document.createElement("b");
		arrow.textContent = "↗";
		link.append(number, copy, arrow);
		container.append(link);
	}
}

async function handleSearch(input: HTMLInputElement): Promise<void> {
	const query = input.value.trim().toLocaleLowerCase();
	const status = document.querySelector<HTMLElement>("[data-search-status]");
	if (!query) {
		renderSearchResults([], "");
		return;
	}
	if (status) status.textContent = "正在扫描任务索引...";
	try {
		renderSearchResults(await loadSearchIndex(), query);
	} catch {
		if (status) status.textContent = "RSS 索引暂时不可用。控制台仍可关闭，普通导航不受影响。";
		document.querySelector<HTMLElement>("[data-search-results]")?.replaceChildren();
	}
}

function updateRouteState(): void {
	const current = normalizedPath(window.location.pathname);
	for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-route-link]")) {
		const path = normalizedPath(link.dataset.routePath || link.href);
		const active = path === "/" ? current === "/" : current.startsWith(path);
		link.toggleAttribute("aria-current", active);
	}
	for (const signal of document.querySelectorAll<HTMLElement>("[data-route-signal]")) {
		signal.dataset.routeSignal = current;
	}
	const article = Boolean(document.querySelector("[data-article-body]"));
	document.documentElement.dataset.routeKind = article ? "article" : "module";
	updateReadingProgress();
	initGiscus();
}

function updateReadingProgress(): void {
	const article = document.querySelector<HTMLElement>("[data-article-body]");
	const rail = document.querySelector<HTMLElement>("[data-reading-rail]");
	const progressNode = document.querySelector<HTMLElement>("[data-reading-progress]");
	const percentageNode = document.querySelector<HTMLElement>("[data-reading-percentage]");
	if (!rail || !progressNode || !percentageNode) return;
	if (!article) {
		rail.dataset.active = "false";
		return;
	}
	const start = article.getBoundingClientRect().top + window.scrollY;
	const available = Math.max(1, article.offsetHeight - window.innerHeight * 0.55);
	const percentage = Math.min(1, Math.max(0, (window.scrollY - start + 120) / available));
	rail.dataset.active = "true";
	rail.dataset.complete = String(percentage >= 0.995);
	progressNode.style.transform = `scaleY(${percentage})`;
	percentageNode.textContent = String(Math.round(percentage * 100)).padStart(3, "0");
	const backTop = document.querySelector<HTMLElement>("[data-back-top]");
	if (backTop) backTop.dataset.visible = String(window.scrollY > 560);
}

function updateToc(): void {
	const links = [...document.querySelectorAll<HTMLAnchorElement>("[data-toc-link]")];
	if (links.length === 0) return;
	let activeId = links[0].hash.slice(1);
	for (const link of links) {
		const id = decodeURIComponent(link.hash.slice(1));
		const heading = document.getElementById(id);
		if (heading && heading.getBoundingClientRect().top <= 180) activeId = id;
	}
	for (const link of links) {
		link.setAttribute("aria-current", String(decodeURIComponent(link.hash.slice(1)) === activeId));
	}
}

function initGiscus(): void {
	const host = document.querySelector<HTMLElement>("[data-giscus-host]");
	if (!host || host.querySelector("iframe, script")) return;
	const script = document.createElement("script");
	script.src = "https://giscus.app/client.js";
	script.async = true;
	script.crossOrigin = "anonymous";
	for (const [key, value] of Object.entries(host.dataset)) {
		if (key === "giscusHost" || value === undefined) continue;
		const attribute = `data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
		script.setAttribute(attribute, value);
	}
	host.append(script);
}

function updateClock(): void {
	const value = new Intl.DateTimeFormat("zh-CN", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(new Date());
	for (const clock of document.querySelectorAll<HTMLElement>("[data-system-clock]")) clock.textContent = value;
}

async function connectCoreRuntimes(): Promise<void> {
	for (let attempt = 0; attempt < 60; attempt += 1) {
		if (window.blogStats && window.blogBackground) break;
		await new Promise((resolve) => window.setTimeout(resolve, 50));
	}
	const root = document.documentElement;
	window.blogStats?.configure({
		baseUrl: root.dataset.umamiBase,
		shareId: root.dataset.umamiShare,
		timezone: root.dataset.umamiTimezone,
		concurrency: 4,
		retryDelays: [250, 750],
	});
	window.blogStats?.bindLifecycle(document);
	window.blogBackground?.bindLifecycle(document);
	void window.blogStats?.initialize(document);
	void window.blogBackground?.initialize(document);
}

function handleDocumentClick(event: MouseEvent): void {
	const target = event.target instanceof Element ? event.target : null;
	if (!target) return;
	const open = target.closest<HTMLElement>("[data-command-open]");
	if (open) {
		openCommand(open.dataset.commandOpen === "settings" ? "settings" : "search", open);
		return;
	}
	if (target.closest("[data-command-close]")) {
		closeCommand();
		return;
	}
	const tab = target.closest<HTMLButtonElement>("[data-command-tab]");
	if (tab) switchCommandPane(tab.dataset.commandTab === "settings" ? "settings" : "search");
	const theme = target.closest<HTMLButtonElement>("[data-theme-choice]");
	if (theme) applySettings({ ...settings, theme: theme.dataset.themeChoice as AppearanceSettings["theme"] }, true);
	if (target.closest("[data-back-top]")) {
		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
	}
	if (target.closest("[data-command-layer] a")) closeCommand();

	const copyButton = target.closest<HTMLElement>(".copy-btn");
	if (copyButton) {
		const code = [...(copyButton.closest("pre")?.querySelectorAll<HTMLElement>(".code:not(summary *)") ?? [])]
			.map((line) => line.textContent === "\n" ? "" : line.textContent)
			.join("\n");
		void navigator.clipboard?.writeText(code);
		copyButton.classList.add("success");
		window.setTimeout(() => copyButton.classList.remove("success"), 1000);
	}
}

function handleDocumentInput(event: Event): void {
	const target = event.target;
	if (target instanceof HTMLInputElement && target.matches("[data-command-search]")) void handleSearch(target);
	if (target instanceof HTMLInputElement && target.matches("[data-background-toggle]")) {
		applySettings({ ...settings, backgroundVisible: target.checked }, true);
	}
	if (target instanceof HTMLInputElement && target.matches("[data-background-blur]")) {
		applySettings({ ...settings, backgroundBlur: Number(target.value) }, true);
	}
}

function handleKeyboard(event: KeyboardEvent): void {
	const target = event.target;
	const isEditing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
	if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
		event.preventDefault();
		openCommand("search");
		return;
	}
	if (event.key === "/" && !isEditing) {
		event.preventDefault();
		openCommand("search");
		return;
	}
	const layer = document.querySelector<HTMLElement>("[data-command-layer]");
	if (layer && !layer.hidden) {
		if (event.key === "Escape") {
			event.preventDefault();
			closeCommand();
			return;
		}
		if (event.key === "Tab") {
			const items = focusableElements(layer);
			if (items.length === 0) return;
			const first = items[0];
			const last = items[items.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}
		return;
	}
	if (event.altKey && !isEditing && event.key === "ArrowLeft") {
		const newer = document.querySelector<HTMLAnchorElement>("[data-nav-newer]");
		if (newer) window.location.href = newer.href;
	}
	if (event.altKey && !isEditing && event.key === "ArrowRight") {
		const older = document.querySelector<HTMLAnchorElement>("[data-nav-older]");
		if (older) window.location.href = older.href;
	}
}

export function startArcadeRuntime(): void {
	const global = window as ArcadeWindow;
	if (global.__arcadeRuntimeStarted) {
		updateRouteState();
		return;
	}
	global.__arcadeRuntimeStarted = true;
	settings = readAppearanceSettings(window.localStorage);
	applySettings(settings);
	document.addEventListener("click", handleDocumentClick);
	document.addEventListener("input", handleDocumentInput);
	document.addEventListener("keydown", handleKeyboard);
	window.addEventListener("scroll", () => {
		updateReadingProgress();
		updateToc();
	}, { passive: true });
	window.addEventListener("resize", updateReadingProgress, { passive: true });
	getMediaQuery().addEventListener("change", () => {
		if (settings.theme === "auto") applySettings(settings);
	});
	for (const eventName of pageEvents) document.addEventListener(eventName, updateRouteState);
	updateClock();
	window.setInterval(updateClock, 30_000);
	updateRouteState();
	void connectCoreRuntimes();
}
