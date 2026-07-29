import type {
	PostCollectionGroup,
	PostEntry,
	PostLink,
	PostNavigation,
	PostSummary,
} from "@/types/content";

export const DEFAULT_POST_CATEGORY = "未分类";
export const DEFAULT_POST_TYPE = "article";

type PostLike = Pick<PostEntry, "slug" | "data">;

export function normalizeFeaturedWeight(
	value: boolean | number | undefined,
): number {
	if (value === true) return 1;
	if (value === false || value === undefined || !Number.isFinite(value))
		return 0;
	return Math.max(0, Number(value));
}

export function comparePosts(a: PostLike, b: PostLike): number {
	const pinnedDifference =
		Number(Boolean(b.data.pinned)) - Number(Boolean(a.data.pinned));
	if (pinnedDifference !== 0) return pinnedDifference;

	const featuredDifference =
		normalizeFeaturedWeight(b.data.featured) -
		normalizeFeaturedWeight(a.data.featured);
	if (featuredDifference !== 0) return featuredDifference;

	const publishedDifference =
		b.data.published.getTime() - a.data.published.getTime();
	if (publishedDifference !== 0) return publishedDifference;

	if (a.slug === b.slug) return 0;
	return a.slug < b.slug ? -1 : 1;
}

export function filterPosts<T extends PostLike>(
	posts: readonly T[],
	includeDrafts: boolean,
): T[] {
	return posts.filter((post) => includeDrafts || post.data.draft !== true);
}

export function sortPosts<T extends PostLike>(posts: readonly T[]): T[] {
	return [...posts].sort(comparePosts);
}

export function getPostUrl(slug: string): string {
	return `/posts/${slug.replace(/^\/+|\/+$/g, "")}/`;
}

export function toPostLink(post: PostLike): PostLink {
	return {
		slug: post.slug,
		title: post.data.title,
		url: getPostUrl(post.slug),
	};
}

export function toPostSummary(post: PostLike): PostSummary {
	return {
		...toPostLink(post),
		published: new Date(post.data.published),
		updated: post.data.updated ? new Date(post.data.updated) : undefined,
		description: post.data.description ?? "",
		image: post.data.image ?? "",
		tags: [...(post.data.tags ?? [])],
		lang: post.data.lang ?? "",
		pinned: Boolean(post.data.pinned),
		featuredWeight: normalizeFeaturedWeight(post.data.featured),
		category: post.data.category?.trim() || DEFAULT_POST_CATEGORY,
		series: post.data.series?.trim() || undefined,
		type: post.data.type?.trim() || DEFAULT_POST_TYPE,
	};
}

export function getPostNavigation<T extends PostLike>(
	posts: readonly T[],
	slug: string,
): PostNavigation {
	const index = posts.findIndex((post) => post.slug === slug);
	if (index === -1) return { newer: null, older: null };

	return {
		newer: index > 0 ? toPostLink(posts[index - 1]) : null,
		older: index < posts.length - 1 ? toPostLink(posts[index + 1]) : null,
	};
}

export function groupPostSummaries(
	posts: readonly PostSummary[],
	field: "category" | "series" | "type" = "category",
): PostCollectionGroup[] {
	const groups = new Map<string, PostSummary[]>();
	for (const post of posts) {
		const value = field === "series" ? post.series : post[field];
		if (!value) continue;
		const grouped = groups.get(value) ?? [];
		grouped.push(post);
		groups.set(value, grouped);
	}

	return [...groups.entries()].map(([key, groupedPosts]) => ({
		key,
		label: key,
		posts: [...groupedPosts],
	}));
}

export function withLegacyNavigation<T extends PostLike>(
	posts: readonly T[],
): T[] {
	return posts.map((post, index) => {
		const newer = index > 0 ? posts[index - 1] : null;
		const older = index < posts.length - 1 ? posts[index + 1] : null;
		return {
			...post,
			data: {
				...post.data,
				nextSlug: newer?.slug ?? "",
				nextTitle: newer?.data.title ?? "",
				prevSlug: older?.slug ?? "",
				prevTitle: older?.data.title ?? "",
			},
		};
	});
}
