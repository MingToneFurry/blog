export function pathsEqual(path1: string, path2: string) {
	const normalizedPath1 = path1.replace(/^\/|\/$/g, "").toLowerCase();
	const normalizedPath2 = path2.replace(/^\/|\/$/g, "").toLowerCase();
	return normalizedPath1 === normalizedPath2;
}

function joinUrl(...parts: string[]): string {
	const joined = parts.join("/");
	return joined.replace(/\/+/g, "/");
}

export function getPostUrlBySlug(slug: string): string {
	return url(`/posts/${slug}/`);
}

export function getDir(path: string): string {
	const lastSlashIndex = path.lastIndexOf("/");
	if (lastSlashIndex < 0) {
		return "/";
	}
	return path.substring(0, lastSlashIndex + 1);
}

export function normalizePathname(input: string): string {
	const raw = String(input || "/").trim();
	let pathname = raw;

	try {
		pathname = new URL(raw, "https://blog.invalid").pathname;
	} catch {
		pathname = raw.split(/[?#]/, 1)[0] || "/";
	}

	try {
		pathname = decodeURIComponent(pathname);
	} catch {
		// Preserve malformed percent sequences instead of throwing in UI runtimes.
	}

	pathname = pathname.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
	if (!pathname.startsWith("/")) pathname = `/${pathname}`;
	if (pathname !== "/" && !pathname.endsWith("/")) pathname += "/";
	return pathname;
}

export function url(path: string) {
	return joinUrl("", import.meta.env.BASE_URL, path);
}
