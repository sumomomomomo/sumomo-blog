// Type definitions for Astro frontmatter

export interface Image {
  url: string;
  alt: string;
}

export interface Frontmatter {
  title: string;
  pubDate: string;
  description: string;
  author: string;
  image?: Image;
  tags: string[];
  nextPostId?: string;
  prevPostId?: string;
}
