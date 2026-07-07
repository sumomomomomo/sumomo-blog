---
layout: '@/layouts/BlogPost.astro'
title: 'Markdown Formatting Test'
pubDate: 2025-06-26
description: 'A comprehensive test of common markdown formatting used in technical blog posts, including code blocks, tables, lists, and more.'
author: 'Sumomo Blog'
image:
    url: 'https://docs.astro.build/assets/rose.webp'
    alt: 'The Astro logo on a dark background with a pink glow.'
tags: ["markdown", "testing", "documentation"]
---

# Markdown Formatting Test

This post is a comprehensive test of common markdown formatting patterns used in technical blog posts. Deploy this and verify that everything renders correctly.

---

## Headings

# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

---

## Text Formatting

This is **bold text** and this is *italic text*.

You can also combine **bold and *italic* together** for emphasis.

Here is ~~strikethrough text~~ which should be crossed out.

Inline `code` looks like this using backticks.

Text can be <sup>superscripted</sup> and <sub>subscripted</sub> using HTML tags.

---

## Links

### External Links

- [Astro Documentation](https://docs.astro.build)
- [GitHub](https://github.com)
- [MDN Web Docs](https://developer.mozilla.org)

### Internal Links

- [Home Page](/)
- [Blog Page](/blog)
- [About Page](/about)

### Anchor Links

- [Jump to Code Blocks](#code-blocks)
- [Jump to Tables](#tables)
- [Jump to Lists](#lists)

### Links with Titles

- [Link with Title](https://docs.astro.build "Visit Astro Docs")

---

## Images

### Inline Image

![Astro Logo](https://docs.astro.build/assets/rose.webp "Astro Rose")

### Image with Caption

![Astro Logo with Gradient](https://docs.astro.build/assets/arc.webp "Arc with purple gradient")

*The Astro logo with a purple gradient arc.*

---

## Code Blocks

### JavaScript

```javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}

const users = ['Alice', 'Bob', 'Charlie'];
users.forEach(user => greet(user));

class Person {
  constructor(name, age) {
    this.name = name;
    this.age = age;
  }

  getGreeting() {
    return `Hi, I'm ${this.name} and I'm ${this.age} years old.`;
  }
}

const person = new Person('Sumomo', 25);
console.log(person.getGreeting());
```

### TypeScript

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
}

type ApiResponse<T> = {
  data: T;
  status: number;
  message: string;
};

async function fetchUser(id: number): Promise<ApiResponse<User>> {
  const response = await fetch(`/api/users/${id}`);
  const data = await response.json();
  return data as ApiResponse<User>;
}

const user = await fetchUser(1);
console.log(user.data.name);
```

### Python

```python
import asyncio
from typing import List, Optional

class BlogPost:
    def __init__(self, title: str, content: str, author: str):
        self.title = title
        self.content = content
        self.author = author
        self.tags: List[str] = []

    def add_tag(self, tag: str):
        if tag not in self.tags:
            self.tags.append(tag)

    async def publish(self) -> bool:
        print(f"Publishing '{self.title}' by {self.author}")
        return True

async def main():
    post = BlogPost(
        title="My First Post",
        content="This is the content...",
        author="Sumomo"
    )
    post.add_tag("python")
    post.add_tag("async")
    await post.publish()

asyncio.run(main())
```

### Bash / Shell

```bash
#!/bin/bash

# Build and deploy the blog
set -e

echo "Installing dependencies..."
npm ci

echo "Building the project..."
npm run build

echo "Running tests..."
npm test

echo "Deploying to server..."
docker-compose up -d --build

echo "Deployment complete!"
```

### HTML

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Blog Post</title>
  <link rel="stylesheet" href="/styles/global.css">
</head>
<body>
  <header>
    <nav>
      <a href="/">Home</a>
      <a href="/blog">Blog</a>
      <a href="/about">About</a>
    </nav>
  </header>
  <main>
    <article>
      <h1>My Blog Post</h1>
      <p>Welcome to my blog!</p>
    </article>
  </main>
  <footer>
    <p>&copy; 2025 Sumomo Blog</p>
  </footer>
</body>
</html>
```

### CSS

```css
:root {
  --primary-color: #7546c2;
  --text-color: #333;
  --bg-color: #fff;
  --font-family: 'Inter', sans-serif;
}

body {
  font-family: var(--font-family);
  color: var(--text-color);
  background-color: var(--bg-color);
  line-height: 1.6;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}
```

### JSON

```json
{
  "name": "sumomo-blog",
  "version": "1.0.0",
  "description": "A technical blog built with Astro",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "astro": "^4.0.0",
    "@astrojs/react": "^3.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "typescript": "^5.0.0"
  }
}
```

### SQL

```sql
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  author_id INTEGER REFERENCES users(id),
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_posts_slug ON posts(slug);
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_published ON posts(published_at) WHERE published_at IS NOT NULL;

SELECT p.title, p.slug, u.name AS author
FROM posts p
JOIN users u ON p.author_id = u.id
WHERE p.published_at IS NOT NULL
ORDER BY p.published_at DESC
LIMIT 10;
```

### Go

```go
package main

import (
    "fmt"
    "log"
    "net/http"
)

type BlogPost struct {
    Title   string `json:"title"`
    Slug    string `json:"slug"`
    Author  string `json:"author"`
    Content string `json:"content"`
}

func handlePosts(w http.ResponseWriter, r *http.Request) {
    posts := []BlogPost{
        {Title: "First Post", Slug: "first-post", Author: "Sumomo"},
        {Title: "Second Post", Slug: "second-post", Author: "Sumomo"},
    }

    fmt.Fprintf(w, "%d posts found", len(posts))
}

func main() {
    http.HandleFunc("/posts", handlePosts)
    log.Println("Server starting on :8080")
    log.Fatal(http.ListenAndServe(":8080", nil))
}
```

### Rust

```rust
use std::collections::HashMap;

#[derive(Debug, Clone)]
struct BlogPost {
    id: u32,
    title: String,
    content: String,
    tags: Vec<String>,
}

impl BlogPost {
    fn new(id: u32, title: &str, content: &str) -> Self {
        Self {
            id,
            title: title.to_string(),
            content: content.to_string(),
            tags: Vec::new(),
        }
    }

    fn add_tag(&mut self, tag: &str) {
        if !self.tags.contains(&tag.to_string()) {
            self.tags.push(tag.to_string());
        }
    }
}

fn main() {
    let mut post = BlogPost::new(1, "Rust Blog Post", "Learning Rust!");
    post.add_tag("rust");
    post.add_tag("programming");
    println!("{:?}", post);
}
```

### Diff

```diff
--- a/package.json
+++ b/package.json
@@ -1,6 +1,6 @@
 {
   "name": "sumomo-blog",
-  "version": "0.1.0",
+  "version": "1.0.0",
   "scripts": {
-    "dev": "astro dev --watch",
+    "dev": "astro dev",
     "build": "astro build"
   }
 }
```

---

## Lists

### Unordered Lists

- First item
- Second item
- Third item
  - Nested item A
  - Nested item B
    - Deeply nested item
- Fourth item

### Ordered Lists

1. First step: Install dependencies
2. Second step: Configure the project
   1. Create environment file
   2. Set up database connection
3. Third step: Run the development server
4. Fourth step: Verify everything works

### Task Lists

- [x] Create markdown file
- [x] Add frontmatter
- [x] Write headings section
- [x] Write code blocks section
- [x] Write tables section
- [ ] Deploy and test
- [ ] Verify rendering

---

## Tables

### Simple Table

| Name | Age | City |
|------|-----|------|
| Alice | 30 | New York |
| Bob | 25 | San Francisco |
| Charlie | 35 | London |

### Table with Alignment

| Left Aligned | Center Aligned | Right Aligned |
|:-------------|:--------------:|--------------:|
| Foo          |     Bar        |          100  |
| Baz          |    Qux         |          200  |
| Quux        |   Quuz         |         1000  |

### Complex Table

| Feature | Astro | Next.js | Nuxt | Remix |
|---------|-------|---------|------|-------|
| Framework Type | Static Site Generator | Full-stack | Full-stack | Full-stack |
| Language | TypeScript | TypeScript/JavaScript | TypeScript/Vue | TypeScript |
| SSR Support | Yes | Yes | Yes | Yes |
| Static Export | Yes | Yes | Yes | No |
| File-based Routing | Yes | Yes | Yes | Yes |
| Islands Architecture | Yes | No | No | No |

### Table with Code

| Language | Hello World Example |
|----------|-------------------|
| JavaScript | `console.log("Hello")` |
| Python | `print("Hello")` |
| Go | `fmt.Println("Hello")` |
| Rust | `println!("Hello");` |

---

## Blockquotes

> This is a simple blockquote.
> It can span multiple lines.

> **Important:** This is a blockquote with **bold text** and *italic text*.
>
> You can also include `inline code` and [links](https://example.com) inside blockquotes.

> ### Nested Heading in Blockquote
>
> This blockquote contains a heading and a list:
>
> - Item 1
> - Item 2
> - Item 3

> > This is a nested blockquote inside another blockquote.
> > It demonstrates multi-level quoting.

---

## Horizontal Rules

Here is some text above a horizontal rule.

---

And here is text below it.

***

You can also use asterisks for a horizontal rule.

---

## Mixed Content

### Paragraph with Multiple Elements

This paragraph contains **bold**, *italic*, `inline code`, [a link](https://example.com), and ~~strikethrough~~ all in one sentence. It also demonstrates how markdown handles **mixed formatting** within a single block of text.

Here is another paragraph that follows immediately after, showing how paragraph separation works in markdown rendering.

### Code with Explanation

When working with asynchronous code in JavaScript, you have several options:

```javascript
// Using Promises
fetch('/api/data')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error(error));

// Using async/await (preferred)
async function fetchData() {
  try {
    const response = await fetch('/api/data');
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}
```

The `async/await` syntax is generally preferred because it makes asynchronous code look and behave more like synchronous code, which improves readability.

### List with Code Examples

Here are the steps to set up a new Astro project:

1. **Create the project**
   ```bash
   npm create astro@latest
   ```

2. **Navigate to the project directory**
   ```bash
   cd my-astro-blog
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

---

## Edge Cases

### Empty Code Block

```

```

### Code Block with Special Characters

```html
<div class="container" id="main">
  <p>Price: $100 & up</p>
  <a href="https://example.com?foo=bar&baz=qux">Link</a>
</div>
```

### Long Line

This is a test with a very long line to see how the renderer handles overflow: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

### Consecutive Special Characters

Here are some consecutive asterisks: **** and here are some consecutive hashes: #### and here are some consecutive underscores: ____

### Numbers and Versions

- Node.js v18.0.0
- TypeScript 5.0
- Astro v4.0.0
- Port: 3000
- Error code: 404

---

## Conclusion

If you can see all the above content rendered correctly, then your markdown processor is handling all the common cases that appear in technical blog posts. This includes:

- Multiple heading levels
- Text formatting (bold, italic, strikethrough, code)
- Links (internal, external, anchors)
- Images with captions
- Code blocks with syntax highlighting for multiple languages
- Ordered, unordered, and nested lists
- Task lists
- Tables with various alignments
- Blockquotes (including nested ones)
- Horizontal rules
- Mixed content combining multiple elements

Feel free to extend this test with additional edge cases as needed.