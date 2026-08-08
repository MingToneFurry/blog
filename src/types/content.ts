import type { CollectionEntry } from "astro:content";

export type PostEntry = CollectionEntry<"posts">;

export type PostLink = {
	slug: string;
	title: string;
	url: string;
};

export type PostSummary = PostLink & {
	published: Date;
	updated?: Date;
	description: string;
	image: string;
	tags: string[];
	lang: string;
	pinned: boolean;
	featuredWeight: number;
	category: string;
	series?: string;
	type: string;
};

export type PostNavigation = {
	newer: PostLink | null;
	older: PostLink | null;
};

export type PostCollectionGroup = {
	key: string;
	label: string;
	posts: PostSummary[];
};
