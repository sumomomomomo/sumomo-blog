---
layout: '@/layouts/BlogPost.astro'
title: 'Vibe Coding, Part 3 (final)'
pubDate: 2026-07-10
description: 'Lessons learnt from vibe coding.'
author: 'Astro Learner'
image:
    url: 'https://docs.astro.build/assets/rose.webp'
    alt: 'The Astro logo on a dark background with a pink glow.'
tags: ["utokyo","vibe-coding"]
prevPostId: utokyo-vibe-coding-2
---

Now I will try my hardest to pinpoint the exact moments I learned big things.

**Where most of my learning occured**

Ultimately, it was during the second manual sprint.

The first sprint, however, was invaluable in providing a point of reference for what I should be able to do.

**Deriving vibe-coding "best-practices" from first principles**

Similar to how rules in the Singapore Armed Forces are written by blood, I believe all best practices have similar origins. I think I can give a few observations from my primary pain points:

1. Test-driven development is a non-negotiable.

From my experience, it is almost a given that every time the AI tells me "it is finished", it is not finished. I had to resort to manual QA work after every AI-made change.

?? agrees with my point [source]. In fact, he says that frontend development on a mature codebase is something that AI is still not very proficient in. They can bang out an impressive looking prototype out of nothing, but usually that's the extent of their abilities. Playwright MCP was raised as an option for models with vision capabilites, but he states that ... . [source]

2. Some domain knowledge is required to properly evaluate AI outputs.

For instance, I had no idea whether Qwen's gigantic .css file during the CSS migration was good practice or not, until I checked with the much more powerful GPT 5.5.

3. Start a fresh thread as often as you can.

A popular way people vibe code is by copy pasting error logs into the AI in a loop until it gets solved. But they often don't notice the mountain of bugs produced. It is like shooting at a mosquito with a shotgun.

I very very intimately experienced how much dumber the AI got when it exceeds around 100k tokens worth of context. Almost every time, when I start a fresh thread, it one-shots the solution I needed.

4. Give AI tasks that are as small as possible. Atomic tasks, if you will.

AI (or at least Qwen) will make many stupid assumptions if left unchecked. For example, ... .

**Conclusion**

Overall, did I actually become a "better" frontend developer? 

I would say I certainly did, conceptually (Whether or not I will do well enough for an interview I do not know). I had no idea what flexboxes were before this journey, or what any of the margin/padding mumbo jumbo meant, even. I always felt I learned better by banging my head against the wall, instead of by reading the book on how a wall should be banged, and so it suited my learning style pretty well overall.

Regarding the friction of education, I would say, however, that it is nearly impossible to improve at the execution level, no matter how precisely someone approaches vibe coding. I had no idea how to center a div, or what a div even was, for example, until Sprint 2.

And so, I feel there is no magic behind vibe coding, in that it will magically make a non-technical person immediately able to create a production level product. Vibe coding is not as simple as telling the AI to do a thing. What if the thing is overly complex? Or the thing contains a huge number of underlying assumptions that are not brought up? What if the output of the AI made the codebase so unbelievably unreadable that nobody in the universe, not even Mythus, can work on it without a desire to end it all?

Vibe coding will probably never go away, but fundamental software engineering principles are definitely here to stay.

**Points to note for future experiments**

1. Experiment with full agentic coding.

The natural evolution to vibe coding is agentic coding, which involves completely going hands-off, and giving AI free reign to pursue whatever goal you give them.

One interesting idea is asking the AI to break down a larger goal into an acyclic DAG, and produce agents to work on it in parallel where possible.

2. Experiment with SKILLS.md.

Maybe it would be possible for Qwen to not be totally dumb if I wrangle it with a harness that screams at it to not be.