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

type LightboxItem = {
	image: HTMLImageElement;
	trigger: HTMLElement;
	source: string;
	caption: string;
	actionHref: string | null;
	actionLabel: string;
};

type ParkedImage = {
	image: HTMLImageElement;
	placeholder: HTMLElement;
	fallback: HTMLImageElement;
	stage: HTMLElement;
	role: string | null;
	tabIndex: string | null;
	lightboxTrigger: string | null;
	ariaHasPopup: string | null;
	ariaLabel: string | null;
};

const directImagePath = /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)$/i;

const pageEvents = [
	"astro:page-load",
	"astro:after-swap",
	"swup:contentReplaced",
	"content:replace",
] as const;

let settings: AppearanceSettings;
let searchIndexPromise: Promise<SearchRecord[]> | null = null;
let commandReturnFocus: HTMLElement | null = null;
let commandCloseTimer: number | null = null;
let lightboxReturnFocus: HTMLElement | null = null;
let lightboxItems: LightboxItem[] = [];
let lightboxIndex = 0;
let parkedImage: ParkedImage | null = null;

function getStorage(): Storage | null {
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}

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
	settings = persist ? writeAppearanceSettings(getStorage(), next) : next;
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
	for (const slider of document.querySelectorAll<HTMLInputElement>("input[data-background-blur-control]")) {
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
	if (commandCloseTimer !== null) {
		window.clearTimeout(commandCloseTimer);
		commandCloseTimer = null;
	}
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

function closeCommand({ immediate = false, restoreFocus = true } = {}): void {
	const layer = document.querySelector<HTMLElement>("[data-command-layer]");
	if (!layer) return;
	delete layer.dataset.open;
	layer.setAttribute("aria-hidden", "true");
	delete document.documentElement.dataset.commandOpen;
	if (commandCloseTimer !== null) window.clearTimeout(commandCloseTimer);
	const finish = () => {
		layer.hidden = true;
		commandCloseTimer = null;
		if (restoreFocus) commandReturnFocus?.focus();
		commandReturnFocus = null;
	};
	if (immediate || layer.hidden) finish();
	else commandCloseTimer = window.setTimeout(finish, 160);
}

function focusableElements(container: HTMLElement): HTMLElement[] {
	return [...container.querySelectorAll<HTMLElement>(
		'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
	)].filter((element) => !element.hidden && element.offsetParent !== null);
}

function getLightbox(): HTMLElement | null {
	return document.querySelector<HTMLElement>("[data-image-lightbox]");
}

function isDirectImageLink(anchor: HTMLAnchorElement, image: HTMLImageElement): boolean {
	try {
		const target = new URL(anchor.href, document.baseURI);
		const sources = [image.currentSrc, image.src]
			.filter(Boolean)
			.map((source) => new URL(source, document.baseURI).href);
		return sources.includes(target.href) || directImagePath.test(target.pathname);
	} catch {
		return false;
	}
}

function isVolatileImageSource(source: string): boolean {
	try {
		const url = new URL(source, document.baseURI);
		return url.searchParams.has("nocache") || (url.hostname === "api.furry.ist" && /^\/furry-img(?:\/|$)/.test(url.pathname));
	} catch {
		return false;
	}
}

function getLightboxItems(): LightboxItem[] {
	const items: LightboxItem[] = [];
	for (const image of document.querySelectorAll<HTMLImageElement>(
		"[data-article-body] img:not([data-no-lightbox]), .arcade-cover img:not([data-no-lightbox])",
	)) {
		const anchor = image.closest<HTMLAnchorElement>("a[href]");
		const source = image.currentSrc || image.src;
		if (!source) continue;
		const directImage = Boolean(anchor && isDirectImageLink(anchor, image));
		const linkedPage = anchor && !directImage ? anchor.href : null;
		const imageTarget = directImage && anchor ? anchor.href : source;
		items.push({
			image,
			trigger: anchor ?? image,
			source,
			caption: image.alt.trim() || image.closest("figure")?.querySelector("figcaption")?.textContent?.trim() || "文章图片",
			actionHref: linkedPage ?? (isVolatileImageSource(imageTarget) ? null : imageTarget),
			actionLabel: linkedPage ? "在新标签页打开图片链接" : "在新标签页打开原图",
		});
	}
	return items;
}

function prepareLightboxTriggers(): void {
	for (const item of getLightboxItems()) {
		const { trigger } = item;
		trigger.dataset.lightboxTrigger = "true";
		trigger.setAttribute("aria-haspopup", "dialog");
		if (!trigger.hasAttribute("aria-label")) trigger.setAttribute("aria-label", `查看大图：${item.caption}`);
		if (trigger === item.image) {
			item.image.tabIndex = 0;
			item.image.setAttribute("role", "button");
		}
	}
}

function restoreParkedImage(): void {
	if (!parkedImage) return;
	const { image, placeholder, fallback, stage, role, tabIndex, lightboxTrigger, ariaHasPopup, ariaLabel } = parkedImage;
	image.removeAttribute("data-lightbox-image");
	if (role === null) image.removeAttribute("role");
	else image.setAttribute("role", role);
	if (tabIndex === null) image.removeAttribute("tabindex");
	else image.setAttribute("tabindex", tabIndex);
	if (lightboxTrigger === null) image.removeAttribute("data-lightbox-trigger");
	else image.setAttribute("data-lightbox-trigger", lightboxTrigger);
	if (ariaHasPopup === null) image.removeAttribute("aria-haspopup");
	else image.setAttribute("aria-haspopup", ariaHasPopup);
	if (ariaLabel === null) image.removeAttribute("aria-label");
	else image.setAttribute("aria-label", ariaLabel);
	if (fallback.isConnected) fallback.replaceWith(image);
	else if (stage.isConnected) {
		const caption = stage.querySelector("figcaption");
		if (caption) stage.insertBefore(fallback, caption);
		else stage.append(fallback);
	}
	if (placeholder.isConnected) placeholder.replaceWith(image);
	else image.remove();
	parkedImage = null;
}

function activateLightboxImage(item: LightboxItem, lightbox: HTMLElement): void {
	if (parkedImage?.image === item.image) return;
	restoreParkedImage();
	const fallback = lightbox.querySelector<HTMLImageElement>("[data-lightbox-image]");
	const stage = lightbox.querySelector<HTMLElement>(".arcade-lightbox-stage");
	if (!fallback || !stage) return;
	const rect = item.image.getBoundingClientRect();
	const placeholder = document.createElement("span");
	placeholder.className = "arcade-lightbox-placeholder";
	placeholder.setAttribute("aria-hidden", "true");
	placeholder.style.width = `${rect.width}px`;
	placeholder.style.height = `${rect.height}px`;
	placeholder.style.display = getComputedStyle(item.image).display === "inline" ? "inline-block" : "block";
	item.image.replaceWith(placeholder);
	fallback.remove();
	const caption = stage.querySelector("figcaption");
	if (caption) stage.insertBefore(item.image, caption);
	else stage.append(item.image);
	item.image.dataset.lightboxImage = "true";
	const role = item.image.getAttribute("role");
	const tabIndex = item.image.getAttribute("tabindex");
	const lightboxTrigger = item.image.getAttribute("data-lightbox-trigger");
	const ariaHasPopup = item.image.getAttribute("aria-haspopup");
	const ariaLabel = item.image.getAttribute("aria-label");
	item.image.removeAttribute("role");
	item.image.removeAttribute("tabindex");
	item.image.removeAttribute("data-lightbox-trigger");
	item.image.removeAttribute("aria-haspopup");
	item.image.removeAttribute("aria-label");
	parkedImage = {
		image: item.image,
		placeholder,
		fallback,
		stage,
		role,
		tabIndex,
		lightboxTrigger,
		ariaHasPopup,
		ariaLabel,
	};
}

function renderLightboxItem(): void {
	const lightbox = getLightbox();
	const item = lightboxItems[lightboxIndex];
	if (!lightbox || !item) return;
	activateLightboxImage(item, lightbox);
	const caption = lightbox.querySelector<HTMLElement>("[data-lightbox-caption]");
	const counter = lightbox.querySelector<HTMLElement>("[data-lightbox-counter]");
	const original = lightbox.querySelector<HTMLAnchorElement>("[data-lightbox-original]");
	const previous = lightbox.querySelector<HTMLButtonElement>("[data-lightbox-prev]");
	const next = lightbox.querySelector<HTMLButtonElement>("[data-lightbox-next]");
	if (caption) {
		caption.textContent = item.caption;
		caption.hidden = !item.caption;
	}
	if (counter) {
		counter.textContent = `IMAGE ${String(lightboxIndex + 1).padStart(2, "0")} / ${String(lightboxItems.length).padStart(2, "0")}`;
	}
	if (original) {
		original.hidden = !item.actionHref;
		if (item.actionHref) original.href = item.actionHref;
		original.setAttribute("aria-label", item.actionLabel);
		original.title = item.actionLabel.replace("在新标签页", "");
	}
	const hasMultiple = lightboxItems.length > 1;
	if (previous) previous.hidden = !hasMultiple;
	if (next) next.hidden = !hasMultiple;
}

function openLightbox(trigger: HTMLElement, requestedImage?: HTMLImageElement): void {
	const image = requestedImage ?? (trigger instanceof HTMLImageElement ? trigger : trigger.querySelector<HTMLImageElement>("img"));
	const lightbox = getLightbox();
	if (!image || !lightbox) return;
	closeCommand({ immediate: true, restoreFocus: false });
	closeLightbox({ restoreFocus: false });
	lightboxItems = getLightboxItems();
	const index = lightboxItems.findIndex((item) => item.image === image && item.trigger === trigger);
	if (index < 0) return;
	lightboxIndex = index;
	lightboxReturnFocus = lightboxItems[index].trigger;
	lightbox.hidden = false;
	lightbox.setAttribute("aria-hidden", "false");
	document.documentElement.dataset.lightboxOpen = "true";
	renderLightboxItem();
	requestAnimationFrame(() => {
		lightbox.querySelector<HTMLButtonElement>("button[data-lightbox-close]")?.focus();
	});
}

function closeLightbox({ restoreFocus = true } = {}): void {
	const lightbox = getLightbox();
	restoreParkedImage();
	if (lightbox) {
		lightbox.hidden = true;
		lightbox.setAttribute("aria-hidden", "true");
	}
	delete document.documentElement.dataset.lightboxOpen;
	if (restoreFocus && lightboxReturnFocus?.isConnected) lightboxReturnFocus.focus();
	lightboxReturnFocus = null;
	lightboxItems = [];
}

function stepLightbox(offset: number): void {
	if (lightboxItems.length < 2) return;
	lightboxIndex = (lightboxIndex + offset + lightboxItems.length) % lightboxItems.length;
	renderLightboxItem();
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
	const toc = document.getElementById("toc");
	toc?.classList.toggle("has-toc", Boolean(toc.querySelector(".arcade-toc")));
	updateReadingProgress();
	initGiscus();
	prepareLightboxTriggers();
}

function handlePageChange(): void {
	closeCommand({ immediate: true, restoreFocus: false });
	closeLightbox({ restoreFocus: false });
	updateRouteState();
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

function decodeTocId(hash: string): string {
	try {
		return decodeURIComponent(hash.slice(1));
	} catch {
		return hash.slice(1);
	}
}

function updateToc(): void {
	const links = [...document.querySelectorAll<HTMLAnchorElement>("[data-toc-link]")];
	if (links.length === 0) return;
	let activeId = decodeTocId(links[0].hash);
	for (const link of links) {
		const id = decodeTocId(link.hash);
		const heading = document.getElementById(id);
		if (heading && heading.getBoundingClientRect().top <= 180) activeId = id;
	}
	for (const link of links) {
		link.setAttribute("aria-current", String(decodeTocId(link.hash) === activeId));
	}
}

function navigateToToc(link: HTMLAnchorElement): boolean {
	const heading = document.getElementById(decodeTocId(link.hash));
	if (!heading) return false;
	const systemBarBottom = document.querySelector<HTMLElement>("[data-system-bar]")?.getBoundingClientRect().bottom ?? 64;
	const telemetryBottom = document.querySelector<HTMLElement>(".arcade-site-telemetry")?.getBoundingClientRect().bottom ?? systemBarBottom;
	const offset = Math.max(100, systemBarBottom, telemetryBottom) + 16;
	const top = Math.max(0, heading.getBoundingClientRect().top + window.scrollY - offset);
	if (window.location.hash !== link.hash) window.history.pushState(null, "", link.hash);
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
	window.setTimeout(updateToc, reduceMotion ? 0 : 320);
	return true;
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

function getEventElements(event: Event): Element[] {
	const path = typeof event.composedPath === "function" ? event.composedPath() : [];
	const elements: Element[] = [];
	for (const target of path) {
		if (target instanceof Element) elements.push(target);
	}
	if (elements.length === 0 && event.target instanceof Element) elements.push(event.target);
	return elements;
}

function closestFromEvent<T extends Element>(event: Event, selector: string): T | null {
	for (const element of getEventElements(event)) {
		const match = element.closest<T>(selector);
		if (match) return match;
	}
	return null;
}

function handleDocumentClick(event: MouseEvent): void {
	if (closestFromEvent(event, "[data-lightbox-close]")) {
		closeLightbox();
		return;
	}
	if (closestFromEvent(event, "[data-lightbox-prev]")) {
		stepLightbox(-1);
		return;
	}
	if (closestFromEvent(event, "[data-lightbox-next]")) {
		stepLightbox(1);
		return;
	}
	const lightboxTrigger = closestFromEvent<HTMLElement>(event, "[data-lightbox-trigger='true']");
	if (lightboxTrigger && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
		event.preventDefault();
		const clickedImage = closestFromEvent<HTMLImageElement>(event, "img");
		openLightbox(lightboxTrigger, clickedImage ?? undefined);
		return;
	}
	const open = closestFromEvent<HTMLButtonElement>(event, "button[data-command-open]");
	if (open) {
		openCommand(open.dataset.commandOpen === "settings" ? "settings" : "search", open);
		return;
	}
	if (closestFromEvent(event, "[data-command-close]")) {
		closeCommand();
		return;
	}
	const tocLink = closestFromEvent<HTMLAnchorElement>(event, "[data-toc-link]");
	if (tocLink && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && navigateToToc(tocLink)) {
		event.preventDefault();
		return;
	}
	const tab = closestFromEvent<HTMLButtonElement>(event, "[data-command-tab]");
	if (tab) switchCommandPane(tab.dataset.commandTab === "settings" ? "settings" : "search");
	const theme = closestFromEvent<HTMLButtonElement>(event, "[data-theme-choice]");
	if (theme) applySettings({ ...settings, theme: theme.dataset.themeChoice as AppearanceSettings["theme"] }, true);
	if (closestFromEvent(event, "[data-back-top]")) {
		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
	}
	const copyButton = closestFromEvent<HTMLElement>(event, ".copy-btn");
	if (copyButton) {
		const code = [...(copyButton.closest("pre")?.querySelectorAll<HTMLElement>(".code:not(summary *)") ?? [])]
			.map((line) => line.textContent === "\n" ? "" : line.textContent)
			.join("\n");
		void navigator.clipboard?.writeText(code);
		copyButton.classList.add("success");
		window.setTimeout(() => copyButton.classList.remove("success"), 1000);
	}
}

function handleCommandNavigation(event: MouseEvent): void {
	if (closestFromEvent(event, "[data-command-layer] a")) {
		closeCommand({ immediate: true, restoreFocus: false });
	}
}

function handleDocumentInput(event: Event): void {
	const target = event.target;
	if (target instanceof HTMLInputElement && target.matches("[data-command-search]")) void handleSearch(target);
	if (target instanceof HTMLInputElement && target.matches("[data-background-toggle]")) {
		applySettings({ ...settings, backgroundVisible: target.checked }, true);
	}
	if (target instanceof HTMLInputElement && target.matches("[data-background-blur-control]")) {
		applySettings({ ...settings, backgroundBlur: Number(target.value) }, true);
	}
}

function handleKeyboard(event: KeyboardEvent): void {
	const target = event.target;
	const isEditing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
	const lightbox = getLightbox();
	if (lightbox && !lightbox.hidden) {
		if (event.key === "Escape") {
			event.preventDefault();
			closeLightbox();
			return;
		}
		if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
			event.preventDefault();
			stepLightbox(event.key === "ArrowLeft" ? -1 : 1);
			return;
		}
		if (event.key === "Tab") {
			const items = focusableElements(lightbox);
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
	if ((event.key === "Enter" || event.key === " ") && target instanceof Element) {
		const lightboxTrigger = target.closest<HTMLElement>("[data-lightbox-trigger='true']");
		if (lightboxTrigger) {
			event.preventDefault();
			openLightbox(lightboxTrigger, target instanceof HTMLImageElement ? target : undefined);
			return;
		}
	}
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
	settings = readAppearanceSettings(getStorage());
	applySettings(settings);
	document.addEventListener("click", handleCommandNavigation, { capture: true });
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
	for (const eventName of pageEvents) document.addEventListener(eventName, handlePageChange);
	updateClock();
	window.setInterval(updateClock, 30_000);
	updateRouteState();
	void connectCoreRuntimes();
}
