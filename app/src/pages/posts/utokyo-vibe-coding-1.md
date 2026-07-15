---
layout: '@/layouts/BlogPost.astro'
title: 'Vibe Coding, Part 1'
pubDate: 2026-06-20
description: 'Introductory post regarding working on this website'
author: 'sumomomomomo'
image:
    url: 'https://cdn.sumomo.horse/blogpost-assets/utokyo-vibe-coding-1/robot-yelling-at-woman.jpg'
    alt: 'Robot yelling at woman.'
tags: ["utokyo","vibe-coding"]
prevPostId: markdown-test
nextPostId: utokyo-vibe-coding-2
---
> "The hottest new programming language is English."
> - [Andrej Karpathy, 2023](https://x.com/karpathy/status/1617979122625712128)

Faced with the looming threat of unemployment (graduation) I set my sights on experimenting with the hottest new thing: vibe coding. Specificially, to wrestle with the question: *Can I learn front-end development while I vibe-code on this website?*

**What is vibe coding?**

The history of how it came to be [is quite muddy](https://vibecodinghistory.com/the-23-month-gap), but it can be summarized by Karpathy's seminal X post, quoted at the top. While there isn't really a "formal" definition of it, not unlike legacy concepts such as Test Driven Development, it is highly probable that you can "vibe" your way to an approximate understanding.

The image that first appears in my mind is an out-of-touch executive telling an emancipated developer to "make a website" and "make it awesome". For vibe coding, the developer is Claude Opus 4.8, and the executive is anybody with an idea. The whole appeal of vibe coding is that it bridges the gap between the end product and the technical know-how required to get there, by letting the AI deal with the difficult technical parts. In return, the vibe coder does not have to deal with any of the technical complexity or own any of the underlying code.

**Won't vibe coding make you stupid?**

A common concern is that it certainly could. One useful concept here is “productive friction”: the effort involved in solving a problem is itself part of how we learn. If you put in the effort to write, for example, a compiler or a disjoint-set-union implementation by hand, specific details may fade over time, but the problem-solving experience remains. Vibe coding threatens to remove much of that friction.

Research into AI-assisted learning points in both directions. In one large field experiment, unrestricted access to GPT-4 improved students’ performance during practice but [left them performing worse once that access was removed](https://www.pnas.org/doi/10.1073/pnas.2422633122). Conversely, a randomized trial found that a carefully designed AI tutor [helped students learn more in less time than an active-learning class](https://www.nature.com/articles/s41598-025-97652-6). AI can act either as an answer machine or as an always-available personal tutor; how it is designed and used appears to matter enormously.

Opinions about vibe coding online are also polarized. Some people are using it to build systems of unprecedented complexity. Pewdiepie, for example, [created a locally hosted AI interface](https://www.youtube.com/watch?v=qw4fDU18RcU), which he later released as the open-source project [Odysseus](https://github.com/pewdiepie-archdaemon/odysseus) - and all without a software engineering background (suspend your disbelief that it has no critical security vulnerabilities whatsoever for a moment). Others warn that AI coding assistants could [eliminate precisely the junior roles](https://www.cio.com/article/3509174/ai-coding-assistants-wave-goodbye-to-junior-developers.html) through which developers traditionally gain experience.

As a short aside, some analysts argue that companies are [“AI-washing” financially motivated layoffs](https://www.forrester.com/press-newsroom/forrester-impact-ai-jobs-forecast/): presenting them as the consequence of technological progress when [pandemic-era overhiring and cost-cutting](https://www.theguardian.com/us-news/2026/feb/08/ai-washing-job-losses-artificial-intelligence) may be more important causes.

**So what are you going to do?**

I'm already pretty stupid, so AI can't possibly make me stupider - especially in the area of front-end development.

So I will approach it simply: *only merge changes that I understand at least conceptually, and ideally fully*. 

Research suggests that [students who explained code examples to themselves understood them better than students who merely read them](https://par.nsf.gov/servlets/purl/10311827), while another experiment found that [studying worked programming examples with self-explanation improved performance on similar problems](https://infonomics-society.org/wp-content/uploads/Scaffolding-Support-for-Self-Explaining-Worked-Examples-in-Learning-Computer-Programming.pdf). At the very least, if I trace the code Qwen gives me, this should give me a more coherent high-level understanding of front-end development and a better chance of reproducing similar solutions myself.

**How it will be done**

Development will be done to add various features to this blog website. The features will be completely aesthetic in nature. It will be done with my local LLM setup (RTX 3090 + RTX 3090 Ti) and Qwen 3.6 27b, using the recipe created by [Club 3090](https://github.com/noonghunna/club-3090). While there are certainly much stronger local models (GLM 5.2 is making waves nowadays [being compared to Opus 4.8](https://artificialanalysis.ai/models/comparisons/glm-5-2-vs-claude-opus-4-8)) I have decided to work with whatever I have right now due to financial and spatial constraints, being in a completely separate country from my server.

It is also a deliberate choice not to use frontier models for the experiment. API costs rack up deceptively quickly, and my income is basically zero. This choice comes with the additional benefit of punishing my poor decisions. One practical advantage of frontier models is that they [require far less handholding and can infer more of the developer's intent](https://cognition.com/blog/frontier-code). I cannot assume that my dingy deployment of Qwen will question me when I make a bad call, so I will have to be more deliberate about how I vibe code with it. My hope is that this carefulness translates into more learning.

Finally, every model needs a harness. My Qwen will use Roo Code over VS Code. This allows me to conveniently read the diffs in an environment I'm familiar with. There are many other hot options now like Pi Code and Hermes Agent, but they slightly stray away from vibe coding into agentic coding, which goes out of the scope of my experiment.

**The two sprints**

The first sprint will involve me prompting Qwen to add various features. It will be expounded upon in the next blogpost. I'll try to limit the scope of the experiment and get the AI to do about 10 hours worth of work a mid-level frontend developer could do. But I'm not a mid-level frontend dev, so I will just estimate things along the way, and keep an Agile mindset and just work on whatever pops out of my mind. After all, the only problem this blog website solves is my own satisfaction. Anyway here's some ideas I have:

- Togglable light/dark mode with persistence
- Responsive design
- Make it look awesome :DDD

The second sprint will be the point where I embody the underpaid junior developer. I will implement the features myself, and avoid vibe coding as far as possible. I will decide the scope of this work after the first sprint.

**What about all the best practices for vibe coding? Are you going to use that?**

As far as possible, I will pick the low-hanging fruit and implement the most basic best practices. Mainly:

- Keep the context window as short as practical. Even when all the relevant information is successfully retrieved, [LLM performance can degrade substantially as the input grows](https://aclanthology.org/2025.findings-emnlp.1264/), including on coding tasks.
- Maintain repository-level instruction files such as [AGENTS.md](https://developers.openai.com/cookbook/articles/codex_exec_plans). These can contain stable instructions such as code-style guidelines, project conventions, testing requirements, and architectural constraints.
- Do not allow Qwen to push directly to `main`. Instead, use [branch protection to require pull requests, reviews, and passing status checks](https://docs.github.com/articles/enabling-required-reviews-for-pull-requests), and have Qwen make its changes on a separate branch for me to review.

There are probably more out there that I don't know about, but ultimately the quality of the codebase is not the main focus of the experiment. These best practices are mainly for squeezing blood (quality) from a rock (AI). While I would certainly prefer for Qwen to not output garbage, I will not be too bummed if it did, because it will introduce the friction of debugging and become a cool learning moment.