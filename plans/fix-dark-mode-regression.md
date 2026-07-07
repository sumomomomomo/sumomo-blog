# Fix Light/Dark Mode Regression Plan

## Problem Summary

After migrating from custom CSS to Tailwind CSS v4, text and background colors no longer respect the light/dark theme toggle. Only the navigation bar and some TTS text respond to theme changes.

## Root Cause Analysis

### Root Cause 1: Body element has no background/text color
The `body` selector in [`tailwind.css`](app/src/styles/tailwind.css:78) only sets layout properties but **no `background-color` or `color`**. The body uses browser defaults (white bg, black text) regardless of theme.

**Before (original global.css):** Used CSS custom properties (`--bg-color`, `--text-color`) that changed based on `[data-theme="dark"]`.

**After (current tailwind.css):** Body has no color styling at all.

### Root Cause 2: Missing global element styles
The original `global.css` had theme-aware styles for `h1`, `h2`, `h3`, `p`, `ul`, `li`, `a` elements using CSS custom properties. These are now missing. Pages like [`index.astro`](app/src/pages/index.astro:14) and [`about.astro`](app/src/pages/about.astro:28) have plain HTML elements without any Tailwind classes.

### Root Cause 3: `@custom-variant dark` definition may not work correctly
The current definition at line 4:
```css
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```

The `data-theme` attribute is set on the `<html>` element (see [`BaseLayout.astro`](app/src/layouts/BaseLayout.astro:24)). The selector `[data-theme="dark"] *` should match descendants, but the `:where()` wrapper may cause specificity issues in Tailwind v4.

**Recommended fix:** Change to:
```css
@custom-variant dark (&:is([data-theme="dark"] &));
```
This is the standard Tailwind v4 pattern for attribute-based dark mode, and it correctly generates selectors like `[data-theme="dark"] .target-class`.

## Detailed Fix Plan

### Step 1: Fix `@custom-variant dark` definition in tailwind.css
**File:** `app/src/styles/tailwind.css`
**Line:** 4

Change from:
```css
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```
To:
```css
@custom-variant dark (&:is([data-theme="dark"] &));
```

**Why:** The `:is([data-theme="dark"] &)` pattern generates `[data-theme="dark"] <selector>`, which correctly targets descendants of the html element that has `data-theme="dark"`.

### Step 2: Add background and text color to body in tailwind.css
**File:** `app/src/styles/tailwind.css`
**Lines:** 78-90

Change the `body` selector to include color properties:
```css
body {
  margin: 0 auto;
  width: 100%;
  max-width: 80ch;
  padding: 1rem;
  line-height: 1.75;
  @apply bg-gray-100 text-stone-800;
}

body[data-theme="dark"],
[data-theme="dark"] body {
  @apply bg-slate-900 text-slate-200;
}
```

**Why:** This ensures the page background and default text color change with the theme. Using direct CSS selectors for the dark variant ensures it works even if `@custom-variant` has issues.

### Step 3: Add global element styles with dark mode support
**File:** `app/src/styles/tailwind.css`
**Location:** After the body styles (around line 91)

Add global styles for common HTML elements:
```css
/* Global element styles with theme support */
h1 {
  @apply text-2xl font-bold text-stone-800 dark:text-slate-100 my-4;
}

h2 {
  @apply text-xl font-bold text-stone-800 dark:text-slate-100 my-4;
}

h3 {
  @apply text-lg font-semibold text-stone-800 dark:text-slate-100 my-3;
}

p {
  @apply text-stone-700 dark:text-slate-300 my-4;
}

ul, ol {
  @apply text-stone-700 dark:text-slate-300 my-4 pl-8;
}

li {
  @apply text-stone-700 dark:text-slate-300 my-1;
}

a {
  @apply text-green-700 dark:text-green-400 underline;
  text-underline-offset: 2px;
}

a:hover {
  @apply text-green-800 dark:text-green-500;
}
```

**Why:** These replace the global styles from the original `global.css` that provided theme-aware colors for all text elements.

### Step 4: Add dark mode classes to index.astro
**File:** `app/src/pages/index.astro`
**Lines:** 14-17

Change from:
```astro
<h1>Under Construction (Astro Edition)</h1>
<img src={cdnUrl} alt="Seiun Sky" width="256" height="256" />
<br>
<a href="https://github.com/sumomomomomo/sumomo-blog">Link to this blog's github repo</a>
```
To:
```astro
<h1 class="text-stone-800 dark:text-slate-100">Under Construction (Astro Edition)</h1>
<img src={cdnUrl} alt="Seiun Sky" width="256" height="256" />
<br>
<a href="https://github.com/sumomomomomo/sumomo-blog" class="text-green-700 dark:text-green-400">Link to this blog's github repo</a>
```

**Why:** The global styles in Step 3 will handle this, but explicit classes provide a safety net.

### Step 5: Add dark mode classes to about.astro plain text elements
**File:** `app/src/pages/about.astro`
**Lines:** 28-44

The `<p>` and `<ul>` elements without classes will be handled by the global styles in Step 3. No changes needed if Step 3 is implemented correctly.

### Step 6: Verify existing dark: classes work
After fixing the `@custom-variant dark` definition, verify that the existing `dark:` classes in the following files work correctly:
- [`Nav.astro`](app/src/components/Nav.astro:16) - Already has `dark:bg-slate-800`, `dark:text-slate-300`, etc.
- [`BlogPost.astro`](app/src/layouts/BlogPost.astro:22) - Already has `dark:bg-slate-800`, `dark:text-slate-100`, etc.
- [`blog.astro`](app/src/pages/blog.astro:44) - Already has `dark:text-slate-100`, `dark:bg-slate-800`, etc.
- [`TTS.tsx`](app/src/components/TTS.tsx:124) - Already has `dark:border-slate-700`, `dark:text-slate-100`, etc.

### Step 7: Test the fix
Build and preview the app to verify:
1. Light mode shows light background and dark text
2. Dark mode shows dark background and light text
3. Theme toggle switches all elements correctly
4. Nav bar continues to work (it was already working)
5. Blog posts, blog list, and TTS all respect the theme

## Color Scheme Reference

| Element | Light Mode | Dark Mode |
|---------|-----------|-----------|
| Body background | `bg-gray-100` (#f3f4f6) | `bg-slate-900` (#0f172a) |
| Body text | `text-stone-800` (#292524) | `text-slate-200` (#e2e8f0) |
| Headings | `text-stone-800` (#292524) | `text-slate-100` (#f1f5f9) |
| Paragraphs | `text-stone-700` (#44403c) | `text-slate-300` (#cbd5e1) |
| Links | `text-green-700` (#15803d) | `text-green-400` (#4ade80) |
| Nav background | `bg-white` (#ffffff) | `bg-slate-800` (#1e293b) |
| Card background | `bg-white` (#ffffff) | `bg-slate-800` (#1e293b) |

## Files to Modify

1. `app/src/styles/tailwind.css` - Fix variant, add body colors, add global element styles
2. `app/src/pages/index.astro` - Add explicit color classes (optional if global styles work)
3. `app/src/pages/about.astro` - Add explicit color classes (optional if global styles work)

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| `@custom-variant` syntax doesn't work in Tailwind v4 | Use direct CSS selectors (`[data-theme="dark"] body`) as fallback |
| Global element styles conflict with component-specific styles | Component-specific classes have higher specificity and will override |
| Color choices don't match original design | Use the same Tailwind color scale already used in Nav and BlogPost components |
