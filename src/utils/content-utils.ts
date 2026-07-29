import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";
import { filterPosts, sortPosts, withLegacyNavigation } from "./content-core";

export async function getSortedPosts(): Promise<CollectionEntry<"posts">[]> {
	const allBlogPosts = await getCollection("posts");
	const visiblePosts = filterPosts(allBlogPosts, !import.meta.env.PROD);
	return withLegacyNavigation(sortPosts(visiblePosts));
}
