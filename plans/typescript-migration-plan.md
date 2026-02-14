# TypeScript Migration Plan for Sumomo Blog

## Project Overview

Current project structure:
- Astro.js 5.2.0 with Node adapter
- 3 .astro pages: [`index.astro`](app/src/pages/index.astro), [`blog.astro`](app/src/pages/blog.astro), [`about.astro`](app/src/pages/about.astro)
- 3 markdown blog posts in [`src/pages/posts/`](app/src/pages/posts/)
- Global CSS in [`global.css`](app/src/styles/global.css)
- Docker and Nginx deployment configuration

## Migration Strategy

### Phase 1: Setup TypeScript Infrastructure

1. **Install TypeScript dependencies**
   - `typescript` - TypeScript compiler
   - `@astrojs/ts-plugin` - Astro's TypeScript plugin
   - `@types/node` - Node.js type definitions

2. **Create `tsconfig.json`**
   - Configure for Astro project
   - Set up path aliases if needed
   - Configure compiler options

3. **Update `astro.config.mjs`**
   - Add TypeScript plugin to the config

### Phase 2: Convert .astro Files

Convert frontmatter from JavaScript to TypeScript syntax:

**[`index.astro`](app/src/pages/index.astro:1)**
```typescript
---
interface Props {
  title: string;
  cdnUrl: string;
}

const { title = "Sumomo Horse", cdnUrl = "..." } = Astro.props;
---
```

**[`blog.astro`](app/src/pages/blog.astro:1)**
```typescript
---
interface Props {
  title: string;
}

const { title = "Sumomo - Blog" } = Astro.props;
---
```

**[`about.astro`](app/src/pages/about.astro:1)**
```typescript
---
interface Props {
  title: string;
}

const { title = "About Me" } = Astro.props;

const identity = {
  firstName: "Not important",
  country: "Canada",
  occupation: "Technical Writer",
  hobbies: ["photography", "birdwatching", "baseball"],
};

const skills: string[] = ["HTML", "CSS", "JavaScript", "React", "Astro", "Writing Docs"];

type TextCase = "uppercase" | "lowercase" | "capitalize";

const happy: boolean = true;
const finished: boolean = false;
const goal: number = 3;

const skillColor: string = "crimson";
const fontWeight: string = "bold";
const textCase: TextCase = "uppercase";
---
```

### Phase 3: Add Type Definitions

Create `src/types/` directory with:
- `frontmatter.d.ts` - Type definitions for markdown frontmatter
- `astro.d.ts` - Astro-specific type extensions

```typescript
// src/types/frontmatter.d.ts
interface Frontmatter {
  title: string;
  pubDate: string;
  description: string;
  author: string;
  image?: {
    url: string;
    alt: string;
  };
  tags: string[];
}

declare namespace Astro {
  interface Frontmatter {
    title: string;
    pubDate: string;
    description: string;
    author: string;
    image?: {
      url: string;
      alt: string;
    };
    tags: string[];
  }
}
```

### Phase 4: Update Configuration Files

**[`package.json`](app/package.json:1)**
```json
{
  "scripts": {
    "dev": "astro dev --host",
    "start": "node ./dist/server/entry.mjs",
    "build": "astro build",
    "preview": "astro preview",
    "typecheck": "astro check"
  }
}
```

**[`Dockerfile`](app/Dockerfile:1)**
- No changes needed (TypeScript compiles to JavaScript at build time)

### Phase 5: Testing

1. Run `npm run typecheck` to verify TypeScript compilation
2. Run `npm run build` to ensure Astro builds successfully
3. Run `npm run dev` to verify development server works

## File Changes Summary

| File | Action |
|------|--------|
| `package.json` | Add TypeScript dependencies, typecheck script |
| `tsconfig.json` | Create new file |
| `astro.config.mjs` | Add @astrojs/ts-plugin |
| `src/pages/index.astro` | Add TypeScript frontmatter types |
| `src/pages/blog.astro` | Add TypeScript frontmatter types |
| `src/pages/about.astro` | Add TypeScript frontmatter types |
| `src/types/frontmatter.d.ts` | Create type definitions |
| `src/types/astro.d.ts` | Create Astro type extensions |

## Benefits of TypeScript Migration

1. **Type Safety**: Catch errors at compile time instead of runtime
2. **Better IDE Support**: Autocomplete, type hints, and refactoring
3. **Documentation**: Types serve as inline documentation
4. **Maintainability**: Easier to understand and modify code
5. **Future-Proof**: Better support for Astro's evolving features

## Potential Challenges

1. **Frontmatter Types**: Astro's frontmatter is dynamic, so we'll need to define interfaces
2. **Markdown Posts**: Frontmatter types need to be defined for markdown files
3. **Build Process**: Ensure TypeScript compilation happens before Astro build

## Rollback Plan

If issues arise:
1. Revert `tsconfig.json` changes
2. Remove TypeScript dependencies
3. Revert .astro files to JavaScript syntax
4. Restore original `astro.config.mjs`
