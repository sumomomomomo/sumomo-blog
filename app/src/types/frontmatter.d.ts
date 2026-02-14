// Type definitions for Astro frontmatter

interface Image {
  url: string;
  alt: string;
}

interface Frontmatter {
  title: string;
  pubDate: string;
  description: string;
  author: string;
  image?: Image;
  tags: string[];
}

declare namespace Astro {
  interface Frontmatter extends Frontmatter {}
}
