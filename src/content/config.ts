import { defineCollection, z } from "astro:content";

const postsCollection = defineCollection({
	schema: z.object({
		title: z.string(),
		published: z.date(),
		updated: z.date().optional(),
		draft: z.boolean().optional().default(false),
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),
		lang: z.string().optional().default(""),
		pinned: z.boolean().optional().default(false),
		category: z.string().optional(),
		series: z.string().optional(),
		type: z.string().optional(),
		featured: z.union([z.boolean(), z.number()]).optional(),

		/* Transitional compatibility for the legacy article page. */
		prevTitle: z.string().default(""),
		prevSlug: z.string().default(""),
		nextTitle: z.string().default(""),
		nextSlug: z.string().default(""),
	}),
});

const assetsCollection = defineCollection({
	type: "data",
	schema: z.object({
		title: z.string().optional(),
		description: z.string().optional(),
	}),
});

export const collections = {
	posts: postsCollection,
	assets: assetsCollection,
};
