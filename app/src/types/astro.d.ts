// Astro type extensions

import type { Frontmatter } from './frontmatter';

declare module 'astro:content' {
  interface CollectionEntry {
    data: Frontmatter;
  }
}
