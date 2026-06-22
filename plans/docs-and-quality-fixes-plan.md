# Documentation & Code Quality Fixes Plan

## Part 1: README.md Documentation Updates

### 1.1 Update Prerequisites Node Version (line 30)
- **File:** [`README.md:30`](README.md:30)
- **Change:** `Node.js v20+` → `Node.js v24+`

### 1.2 Update Install Instructions (lines 38-46)
- **File:** [`README.md:38`](README.md:38)
- **Change:** Add root-level npm install step before `cd app`:
  ```markdown
  # Install root dependencies (Husky)
  npm install

  # Install app dependencies
  cd app
  npm install
  ```

### 1.3 Add Pre-commit Hook Setup Instructions (after line 186)
- **File:** [`README.md:186`](README.md:186)
- **Add:** Note about activating Husky after cloning:
  > **Note:** After cloning, run `npm install` at the project root to activate Husky pre-commit hooks. The hook runs `biome check --write src/` in the `app/` directory before each commit.

### 1.4 Add CI Workflow Documentation (after line 110)
- **File:** [`README.md:110`](README.md:110)
- **Add:** Documentation for `ci.yml`:
  ```markdown
  **CI Workflow (`ci.yml`):**
  Runs on every PR to `main`. Installs root and app dependencies, runs Biome linting, and builds the project to ensure code quality before merging.
  ```

### 1.5 Update Project Structure Tree (lines 116-130)
- **File:** [`README.md:116`](README.md:116)
- **Change:** Add missing files to the tree:
  ```
  .
  ├── package.json           # Root - Husky setup
  ├── package-lock.json      # Root lock file
  ├── .husky/
  │   └── pre-commit         # Auto-format on commit
  ├── .github/workflows/
  │   ├── ci.yml             # CI checks (lint + build)
  │   └── deploy.yml         # Production deployment
  ├── app/                   # Astro Application
  │   ├── src/               # Pages, Layouts, Components
  │   ├── astro.config.mjs   # Configured with { host: true }
  │   └── Dockerfile         # Node.js 24 build
  ├── nginx/
  │   ├── default.conf       # HTTP Block (Web)
  │   └── nginx.conf         # Main Config + Stream Block (SSH)
  ├── docker-compose.yml     # Orchestration
  └── README.md              # Documentation
  ```

---

## Part 2: Code Quality Fixes

### 2.1 Fix Mismatched HTML Tag in index.astro
- **File:** [`app/src/pages/index.astro:26`](app/src/pages/index.astro:26)
- **Current:** `<a href="...">Link to this blog's github repo</h3>`
- **Fix:** Change `</h3>` to `</a>`

### 2.2 Dynamic Blog Post Listing in blog.astro
- **File:** [`app/src/pages/blog.astro`](app/src/pages/blog.astro)
- **Current:** Hardcoded `<li><a href="/posts/post-1/">Post 1</a></li>` etc.
- **Fix:** Use `Astro.glob` to dynamically import and list posts:
  ```astro
  ---
  const posts = Astro.glob('../posts/*.md');
  ---
  <ul>
    {Object.values(posts).map((post) => (
      <li><a href={`/${post.id}`}>{post.metadata.title}</a></li>
    ))}
  </ul>
  ```

### 2.3 Fix `var` to `const` in TTS.tsx
- **File:** [`app/src/components/TTS.tsx:43`](app/src/components/TTS.tsx:43)
- **Current:** `var text = textInputRef.current?.value.trim();`
- **Fix:** Change `var` to `const`

### 2.4 Remove Redundant Declaration in frontmatter.d.ts
- **File:** [`app/src/types/frontmatter.d.ts:17-19`](app/src/types/frontmatter.d.ts:17)
- **Current:**
  ```typescript
  declare namespace Astro {
    interface Frontmatter extends Frontmatter {}
  }
  ```
- **Fix:** Remove this entire block (it's a circular self-extension that does nothing)

---

## Implementation Order

1. README.md updates (all 5 subtasks)
2. index.astro HTML fix
3. blog.astro dynamic posts
4. TTS.tsx var → const
5. frontmatter.d.ts cleanup

Each should be committed together in a single PR with branch name `docs/update-readme-and-code-quality-fixes` or split into `docs/` and `fix/` branches if preferred.
