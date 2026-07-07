---
layout: '@/layouts/BlogPost.astro'
title: 'My First Blog Post'
pubDate: 2026-07-01
description: 'Introductory post regarding working on this website.'
author: 'Astro Learner'
image:
    url: 'https://docs.astro.build/assets/rose.webp'
    alt: 'The Astro logo on a dark background with a pink glow.'
tags: ["utokyo","vibe-coding"]
---
## What is this post about?
This blog is pretty barebones. In fact, it is word for word and beat for beat identical to Astro’s official blog creation tutorial. With the exception that I stopped halfway through. This blog has always been something I have wanted to work on for hosting personal projects. (I am also interested in not going homeless, and having a personal website gives me an additional line to write on my resume).
With my current exchange to UTokyo, and my taking of the class “AI Frenemy”, I put two and two together and proposed to the prof, “Why not I do my Unessay by working on this website via vibe coding?” and was met with a surprising “Ok”. 
## What is Vibe Coding?
Andrej Karpathy made a seminal twitter post once, about how he did some cool thing with LLMs and didn’t even look at the underlying code in the process. [source] Since then coding has become widely accepted as one of the main use cases of LLMs.
The main difference in this “paradigm shift” is that LLM-augmented developers treat the LLM as a junior developer and focus on “software architecture”, leaving implementation to the AI. [source]
## The Goal of this Experiment
Vibe coding itself is a divisive topic, and as someone who has never vibe coded a product into existence, I think I stand a good chance of providing a different perspective on the issue as a computer science student with basically zero experience with front-end development.
I have run LLMs before (Midnight Miqu, gpt-oss 120b…) on my local rig (3090, 3090ti, 64GB of ram). But they were mostly for playing around with and I never did any real work on them. In fact the hardware was mostly used for my Stable Diffusion XL full finetune (maybe I will write about that in the future). So LLMs for local workloads isn’t a totally alien concept to me.
With that in mind, I want to approach this tool with one main goal:
### 1. Exploring the “friction of education” associated with vibe coding
Vibe-coding has been reported to make developers much more stupid, in the sense that they forget how to write proper syntax. For example, [source]. 
Given my lack of frontend programming experience, I want to see how much I need to bend over backwards to make this project actually educational and beneficial for my frontend skills.
Due to financial constraints, I am going to limit this experiment to just my Qwen 3.6 27B model, with the Roo Code extension on VSCode.
## The Rules 
### 1. Implement vibe coding best practices
For example, have a AGENTS.md file in the root directory of the repo that explains the structure of the project. Maybe use AI to generate this.
### 2. Only merge commits I understand fully
This will be the main way I experiment with adding the frictional required for education. 
## The Metrics
### 1. The number of times I bang my head against the wall fixing regressions 
### 2. Time spent between generating the code vs verifying everything works
### 3. Architectural integrity and codebase complexity
### 4. Documentation or lack thereof
### 5. Catastrophic security vulnerabilities
## The Feature Lists
The beginning of each sprint would task the AI to make a concrete “plan of action” based on the features listed below. To ensure some semblance of equivalent complexity I will ask the AI to estimate the “story points” of the whole feature list it proposes. Arbitrarily, I will ask the AI to make 5 story points worth of features, which maps to about 10 to 20 hours of human labour. The rest of the effort would come from human willpower (my ability to read through the slop to understand what’s happening and ask the AI why it did something some way).
The feature lists and instructions will also include both vague and specific instructions. Vague would be stuff that a non coder thinks is sufficient but would actually make an engineer suicidal like, “Make it look like a medium article.” Specific would be stuff that someone skilled would instruct a junior dev to do, like “Make a light/dark mode toggle based off this figma draft that saves state locally.”
### Sprint 1: Finishing up CI/CD; basic aesthetic tweaks
Experiment with "AI-assisted workflows". `

•	
### Sprint 2: Aesthetic polish
Experiment with handing off more planning to the LLM

•	Dark/light mode toggle with persistence
•	

## Wrapping Things Up 
I have no idea whether this is actually a good idea or not. My scope might be a little big, but the main goal remains the comparison between “public perception of vibe coding” and “the realities of vibe coding”. The other two goals are peripheral. The next blog post will cover 