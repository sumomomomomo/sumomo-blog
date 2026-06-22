# Agent Workflow Instructions

## Making Code Changes

When asked to make a code change, follow this workflow:

### 1. Create a Feature Branch

Always start your branch name with a predefined work category:

| Prefix | Purpose |
|--------|---------|
| `feature/` or `feat/` | Adding new functionality or parts of a system |
| `bugfix/` or `fix/` | Resolving errors or bugs in existing code |
| `hotfix/` | Deploying urgent production repairs outside normal release cycles |
| `docs/` | Writing or changing documentation, wikis, or readmes |
| `refactor/` | Improving code structure without altering external behavior |
| `chore/` | Performing routine tasks like updates or configuration adjustments |
| `test/` | Writing missing tests or correcting existing test suites |

**Branch naming format:** `<prefix>/<short-description>`

Examples:
- `feature/add-dark-mode`
- `fix/resolve-login-bug`
- `docs/update-readme`
- `chore/update-dependencies`
- `refactor/simplify-auth-flow`

### 2. Workflow Steps

1. **Stash any uncommitted changes (if on a different branch):**
   ```bash
   git stash
   ```

2. **Switch to main and ensure it's up to date:**
   ```bash
   git checkout main
   git pull origin main
   ```

3. **Pop stashed changes (if you stashed in step 1):**
   ```bash
   git stash pop
   ```

4. **Create a new branch with the appropriate prefix:**
   ```bash
   git checkout -b <prefix>/<description>
   ```

5. **Make the code changes**

6. **Commit with a descriptive message:**
   ```bash
   git add -A
   git commit -m "<prefix>: description of changes"
   ```

7. **Push the branch:**
   ```bash
   git push -u origin <prefix>/<description>
   ```

8. **Create a Pull Request targeting main:**
   ```bash
   gh pr create --base main --head <prefix>/<description> --title "<Prefix>: description" --body "Description of changes and why"
   ```

### 3. Rules

- Always branch from `main`
- Always target `main` for PRs
- Use the prefix that best matches the work being done
- Write clear, descriptive commit messages and PR descriptions
- Do NOT mix multiple categories in a single branch (e.g., don't put docs changes in a feature branch)
