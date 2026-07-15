---
layout: '@/layouts/BlogPost.astro'
title: 'Vibe Coding, Part 2'
pubDate: 2026-07-07
description: 'A tale of two sprints'
author: 'sumomomomomo'
image:
    url: 'https://cdn.sumomo.horse/blogpost-assets/utokyo-vibe-coding-2/robot-yelling-at-door.jpg'
    alt: 'Robot yelling at door.'
tags: ["utokyo","vibe-coding"]
prevPostId: utokyo-vibe-coding-1
nextPostId: utokyo-vibe-coding-3
---
The repository for this website is found [here](https://github.com/sumomomomomo/sumomo-blog/).

### Sprint 0 - Birthing this Website

I have a homelab. I also like self hosting. I like Umamusume and want to eventually make some tools for it. I put three and three together, and decided one day, that it was only right for me to have a personal website.

Honestly it started with me experimenting with devops stuff. I asked Gemini on their web interface what a modern stack for website deployment looks like from end to end, and made a prototype from there.

And so, this is the starting point of our entire journey. Very bare bones.

[Commit at end of Sprint 0](https://github.com/sumomomomomo/sumomo-blog/commit/bda5926c7af375069ec5d49a38e4d364b8d04fde)

![The old home page](https://cdn.sumomo.horse/blogpost-assets/utokyo-vibe-coding-2/1.png "Old home page")

*The old home page.*

![The blog list](https://cdn.sumomo.horse/blogpost-assets/utokyo-vibe-coding-2/2.png "Old blog list")

*The plaintext blog posts section.*

![Old first blog post styling](https://cdn.sumomo.horse/blogpost-assets/utokyo-vibe-coding-2/3.png "Old first blog post and styling")

*The first blog post had zero styling.*

### Sprint 1 - Make it Awesome xD

Pull requests 1 to 11 correspond to this first sprint. Link [here](https://github.com/sumomomomomo/sumomo-blog/pulls?q=is%3Apr+is%3Aclosed).

The features implemented can be summed up as:
- Light/dark mode
- Basic styling for all parts of the website
- Code quality improvements (specifically, a migration from normal CSS back to Tailwind CSS. Qwen decided halfway in to migrate from Tailwind CSS to normal CSS, and I had to steer it back)

The basic workflow would start with me prompting Roo Code. For example,

> Right now the website contains a skeleton for a blog. There is no styling for the individual blog posts. I want you to make a plan to make it look like a medium article (this is intentionally vague - I want you to propose a simple design)
> - The first prompt of Sprint 1

A lot of details are omitted from here (feel free to check out the pull requests), but what happens from here is Qwen will make some change, usually breaking, and I will open up my browser manually to test it. Since Qwen 3.6 27b supports images, screenshotting website bugs does work somewhat effectively.

Ultimately it felt like I was working as a cat wrangler. I had to ask Qwen multiple times about why they chose to do something in a certain way, and cross-check with a more powerful model like GPT 5.5. 

[Commit at end of Sprint 1](https://github.com/sumomomomomo/sumomo-blog/commit/a9c253786f83d080869bdfde216d2477a368e35b)

![The newer home page](https://cdn.sumomo.horse/blogpost-assets/utokyo-vibe-coding-2/sp1_1.png "Newer home page")

*The newer home page. Notice the updated navigation bar and dark mode.*

![The newer blog list](https://cdn.sumomo.horse/blogpost-assets/utokyo-vibe-coding-2/sp1_3.png "Newer blog list")

*Finally, some styling for the blog posts section.*

![Newer first blog post styling](https://cdn.sumomo.horse/blogpost-assets/utokyo-vibe-coding-2/sp1_2.png "Newer first blog post and styling")

*And the base for the styling of the blog posts.*

### Sprint 2 - Something Easy

Pull request 12 corresponds to this second sprint. Link [here](https://github.com/sumomomomomo/sumomo-blog/pull/12).

I decided to work on the styling for individual blogposts. It was (un)surprisingly really painful.

The features implemented were:
- Smoother transitions on navigation
- Better looking blogposts

While I understood most of Sprint 1 on a conceptual level, the main friction came from actually writing the Tailwind CSS to align things. I had to Google every 5 seconds what a "pb" or a "mx" or a whatever is initially. But after about 15 minutes work got much easier.

I did also work on optimizing the code. Particularly the part handling blog post loading, where I had to migrate away from Qwen's `import.meta.glob()` to the more idiomatic Content Collection that Astro offers.

[Commit at end of Sprint 2](https://github.com/sumomomomomo/sumomo-blog/commit/0d8235ad7fc87addc07377f57816755b0849cc6b)

![Blog post styling update](https://cdn.sumomo.horse/blogpost-assets/utokyo-vibe-coding-2/sp2.png "Newest blog post style")

*You can see the enlarged image with author name at the bottom.*