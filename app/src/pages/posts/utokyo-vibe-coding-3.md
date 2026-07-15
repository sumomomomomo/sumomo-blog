---
layout: '@/layouts/BlogPost.astro'
title: 'Vibe Coding, Part 3 (final)'
pubDate: 2026-07-10
description: 'Lessons learnt from vibe coding.'
author: 'sumomomomomo'
image:
    url: 'https://cdn.sumomo.horse/blogpost-assets/utokyo-vibe-coding-3/robot-looking-away.jpg'
    alt: 'Robot looking away.'
tags: ["utokyo","vibe-coding"]
prevPostId: utokyo-vibe-coding-2
---

**Where most of my learning occured**

Ultimately, it was during the second manual sprint. I feel fairly confident with manipulating CSS now. I have prior experience with Typescript so that's not an issue for me.

The first sprint, however, was invaluable in providing a point of reference for what someone at least semi-proficient should be able to do.

**Conclusion**

Overall, did I actually become a "better" frontend developer? 

I would say I learned frontend concepts. Definitely not enough to enter an interview if they task me to create some React component by hand though. 

I had no idea what flexboxes were before this journey, or what any of the margin/padding mumbo jumbo meant, even. I always felt I learned better by banging my head against the wall, instead of by reading the book on how a wall should be banged, and so I think this comparison between "understanding" Qwen's PRs versus "doing" it myself, regarding how much I learn, was fundamentally very biased towards the latter.

Regarding the friction of education, from this experiment, I think that just an understanding of the PRs is insufficient. It is probably nearly impossible to improve at the execution level with just vibe coding and not manual practice, no matter how precisely someone approaches it.

And so, I feel there is no magic behind vibe coding, in that it will magically make a non-technical person immediately able to create a production level product. Vibe coding is not as simple as telling the AI to do a thing. What if the thing is overly complex? Or the thing contains a huge number of underlying assumptions that are not brought up? What if the output of the AI made the codebase so unbelievably unreadable that nobody in the universe, not even the greatest frontier models, can work on it [without a desire for self-annihilation](https://www.businessinsider.com/gemini-self-loathing-i-am-a-failure-comments-google-fix-2025-8)?

But vibe coding will probably never go away though.

## Extra thoughts
**Deriving vibe-coding "best-practices" from first principles**

Similar to how rules in the Singapore Armed Forces are written by blood, I believe all best practices have similar origins. I think I can give a few observations from my primary pain points:

1. Test-driven development is a non-negotiable

From my experience, it is almost a given that every time the AI tells me "it is finished", it is not finished. I had to resort to manual QA work after every AI-made change.

Pocock mentions something [similar](https://www.youtube.com/watch?v=-QFHIoCo-Ko). In fact, he says that frontend development on a mature codebase is something that AI is still not very proficient in. They can bang out an impressive looking prototype out of nothing, but usually that's the extent of their abilities.

2. Some domain knowledge is required to properly evaluate AI outputs

For instance, I had no idea whether Qwen's gigantic .css file during the CSS->Tailwind migration was good practice or not, until I checked with the much more powerful GPT 5.5. Looking back it seems obvious to me now that when I tell Qwen to migrate to use Tailwind, I most definitely did not mean for Qwen to hack together global CSS styling with Tailwind, but at the time it was not.

3. Start a fresh thread as often as you can

A popular way people vibe code is by copy pasting error logs into the AI in a loop until it gets solved. But they often don't notice the mountain of bugs produced. It is like shooting at a mosquito with a shotgun.

I very very intimately experienced how much dumber the AI got when it exceeds around 100k tokens worth of context. Almost every time, when I start a fresh thread, it one-shots the solution I needed (if I gave it a simple enough task).

4. Give AI tasks that are as small as possible. Atomic tasks, even

AI (or at least Qwen) will make many stupid assumptions if left unchecked. When given the task to "make it look like a medium article" in Sprint 1, it completely ignored the fact that the repo used Tailwind CSS, and wrote its own old-style CSS everywhere.

**Points to note for future experiments**

1. Experiment with full agentic coding

The natural evolution to vibe coding is agentic coding, which involves completely going hands-off, and giving AI free reign to pursue whatever goal you give them.

One interesting idea is asking the AI to break down a larger goal into an acyclic DAG, and produce agents to work on it in parallel where possible.

2. Experiment with other markdown files like SKILLS.md/harnesses

Maybe it would be possible for Qwen to not be totally dumb if I wrangle it with a harness that screams at it to not be.