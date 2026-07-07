# Tailwind CSS Migration Plan

## Overview

Migrate the Sumomo Blog project from custom CSS to Tailwind CSS while preserving the existing visual design, theme toggle functionality, and all page layouts.

## Current State

### CSS Files
| File | Lines | Purpose |
|------|-------|---------|
| `global.css` | 370 | Theme variables, base styles, navigation, blog cards, responsive |
| `blog-post.css` | 298 | Blog post layout, typography, code blocks, responsive |
| `tts.css` | 233 | TTS chat interface, animations, responsive |

### Key Features to Preserve
1. **Dark/Light Theme Toggle** - Uses `[data-theme="dark"]` selector with CSS custom properties
2. **Theme-ready class** - Prevents animation on initial load
3. **Blog Card Grid** - Responsive grid with hover effects
4. **Blog Post Typography** - Headings, code blocks, blockquotes, images
5. **TTS Chat Interface** - ChatGPT-style message bubbles, animations
6. **Custom Scrollbar** - Styled scrollbar with theme colors
7. **Responsive Breakpoints** - 768px and 480px/640px breakpoints

## Migration Strategy

### Phase 1: Setup Tailwind CSS

#### 1.1 Install Dependencies
```bash
cd app && npm install -D tailwindcss @tailwindcss/postcss
```

#### 1.2 Create `tailwind.config.mjs`
Configure Tailwind with custom theme colors matching existing CSS variables:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,pug,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // Light theme colors
        'bg-primary': '#f1f5f9',
        'text-primary': '#2c2c2c',
        'heading-primary': '#242424',
        'nav-bg': '#ffffff',
        'nav-border': '#e5e5e5',
        'nav-link': '#242424',
        'nav-link-hover': '#1a8917',
        'card-bg': '#ffffff',
        'card-shadow': 'rgba(0, 0, 0, 0.08)',
        'card-shadow-hover': 'rgba(0, 0, 0, 0.15)',
        'code-bg': '#f6f8fa',
        'blockquote-bg': '#f9f9f9',
        'blockquote-border': '#1a8917',
        'tag-bg': '#f0f0f0',
        'tag-text': '#555',
        'tag-hover': '#e5e5e5',
        'scrollbar-track': '#f1f5f9',
        'scrollbar-thumb': '#cbd5e1',
        'scrollbar-thumb-hover': '#94a3b8',
        'divider': '#e5e5e5',
        'link-primary': '#1a8917',
        'link-hover': '#136c11',
        'meta-text': '#6b6b6b',
        'toggle-bg': 'transparent',
        'toggle-hover': '#e5e5e5',
        'icon-color': '#242424',
      },
      maxWidth: {
        '80ch': '80ch',
        '68ch': '68ch',
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
        mono: ['"SFMono-Regular"', 'Consolas', '"Liberation Mono"', 'Menlo', 'monospace'],
      },
    },
  },
  darkMode: ['class', '[data-theme="dark"]'],
  plugins: [],
}
```

#### 1.3 Create `postcss.config.mjs`
```javascript
export default {
  plugins: {
    tailwindcss: {},
  },
}
```

#### 1.4 Update `astro.config.mjs`
Add Vite CSS configuration for PostCSS:
```javascript
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  output: 'static',
  integrations: [react()],
  server: {
    host: true,
    port: 3000
  },
  vite: {
    css: {
      postcss: 'postcss.config.mjs',
    },
  },
});
```

### Phase 2: Create Tailwind Base Styles

#### 2.1 Create `app/src/styles/tailwind.css`
This replaces all three CSS files with Tailwind directives and custom utilities:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Theme transitions - only apply when theme-ready class is present */
@layer base {
  html {
    @apply bg-bg-primary text-text-primary font-serif;
    scroll-behavior: smooth;
    overflow-y: scroll;
  }

  html.theme-ready {
    transition:
      background-color 0.3s ease,
      color 0.3s ease;
  }

  /* Custom scrollbar */
  html::-webkit-scrollbar {
    width: 8px;
  }

  html::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }

  html::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 4px;
  }

  html::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }

  body {
    @apply mx-auto w-full max-w-80ch p-4 leading-loose;
  }

  body.theme-ready {
    transition:
      background-color 0.3s ease,
      color 0.3s ease;
  }

  * {
    box-sizing: border-box;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  h1 {
    @apply my-4 text-2xl font-bold text-heading-color;
  }

  h1.theme-ready {
    transition: color 0.3s ease;
  }
}

/* Dark mode overrides */
[data-theme="dark"] {
  /* Override CSS variables for dark mode */
  --bg-color: #0f172a;
  --text-color: #cbd5e1;
  /* ... all dark mode variables ... */
}

/* Theme toggle animations */
@layer components {
  .theme-icon {
    @apply absolute w-5 h-5 text-icon-color;
  }

  .theme-ready .theme-icon {
    transition:
      opacity 0.3s ease,
      transform 0.3s ease;
  }

  .sun-icon {
    @apply opacity-100;
    transform: rotate(0deg) scale(1);
  }

  .moon-icon {
    @apply opacity-0;
    transform: rotate(-180deg) scale(0);
  }

  [data-theme="dark"] .sun-icon {
    @apply opacity-0;
    transform: rotate(180deg) scale(0);
  }

  [data-theme="dark"] .moon-icon {
    @apply opacity-100;
    transform: rotate(0deg) scale(1);
  }
}

/* Animations */
@layer utilities {
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .animate-fadeIn {
    animation: fadeIn 0.3s ease-in;
  }

  .animate-spin-custom {
    animation: spin 0.8s linear infinite;
  }
}
```

### Phase 3: Migrate Components

#### 3.1 Update `BaseLayout.astro`
- Change CSS import from `global.css` to `tailwind.css`
- Keep theme initialization script unchanged

#### 3.2 Update `Nav.astro`
Replace class-based styling with Tailwind utilities:
```astro
<nav class="relative flex justify-center items-center gap-6 p-4 bg-nav-bg border-b border-nav-border theme-ready">
  <a class="flex text-nav-link text-sm font-medium hover:text-nav-link-hover" href="/">Home</a>
  <!-- ... other links ... -->
  <button id="theme-toggle" class="theme-toggle right absolute right-0 ...">
    <!-- SVG icons remain unchanged -->
  </button>
</nav>
```

#### 3.3 Update `BlogPost.astro`
Replace all CSS classes with Tailwind utilities:
```astro
<article class="max-w-68ch mx-auto my-8 p-8 bg-card-bg rounded-lg shadow-md theme-ready blog-post">
  <header class="mb-8 blog-post-header">
    <h1 class="text-2xl font-bold text-heading-color leading-tight mb-0 mb-4 blog-post-title">
      {Astro.props.title}
    </h1>
    <!-- ... rest of header ... -->
  </header>
  <!-- ... cover image, content, footer ... -->
</article>
```

#### 3.4 Update `blog.astro`
Replace blog card classes with Tailwind:
```astro
<div class="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-8 mt-8 blog-grid">
  {posts.map((post) => (
    <a href={`/${post.id}`} class="flex flex-col bg-card-bg rounded-xl shadow-md hover:-translate-y-1 hover:shadow-lg transition-all duration-300 blog-card">
      <!-- ... card content ... -->
    </a>
  ))}
</div>
```

#### 3.5 Update `TTS.tsx`
Replace all className values with Tailwind utilities:
```tsx
<div className="max-w-3xl mx-auto p-4 h-[calc(100vh-80px)] flex flex-col tts-container">
  <header className="text-center py-4 border-b border-divider mb-4 tts-header">
    <h1 className="m-0 text-xl text-heading-color">Text to Speech</h1>
  </header>
  <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-4 tts-messages">
    {messages.map((msg) => (
      <div key={msg.id} className={`flex gap-3 animate-fadeIn message ${msg.audioUrl ? 'ai' : 'user'}`}>
        <div className="max-w-[70%] p-3 rounded-2xl leading-relaxed message-content">
          {/* ... message content ... */}
        </div>
      </div>
    ))}
  </div>
  {/* ... input area ... */}
</div>
```

### Phase 4: Cleanup

#### 4.1 Remove Old CSS Files
- Delete `app/src/styles/global.css`
- Delete `app/src/styles/blog-post.css`
- Delete `app/src/styles/tts.css`

#### 4.2 Verify Build
Run `npm run build` to ensure no errors and verify output.

## Implementation Order

1. **Setup** - Install Tailwind, create config files
2. **Base Styles** - Create tailwind.css with all custom utilities
3. **Layouts** - Update BaseLayout.astro and BlogPost.astro
4. **Components** - Update Nav.astro and TTS.tsx
5. **Pages** - Update blog.astro, index.astro, about.astro, tts.astro
6. **Cleanup** - Remove old CSS files
7. **Test** - Build and verify

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Theme toggle stops working | Keep `[data-theme="dark"]` selector approach; use Tailwind's darkMode config |
| Custom scrollbar styling lost | Keep scrollbar styles in custom CSS layer |
| Animation classes don't work | Define custom keyframes in Tailwind config or CSS layer |
| React component className conflicts | Ensure all className values are migrated to Tailwind |
| Build errors from missing PostCSS | Verify PostCSS config is correct |

## Notes

- The `[data-theme="dark"]` approach will be preserved using Tailwind's `darkMode: ['class', '[data-theme="dark"]']` configuration
- Custom CSS variables will be maintained for dynamic theming (scrollbar, transitions)
- The `theme-ready` class pattern will be preserved to prevent animation on initial load
- All existing color values will be mapped to Tailwind's custom color palette
