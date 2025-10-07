# GitHub Pages Deployment Guide for Deploymint Mini

This guide covers how to deploy Deploymint Mini to GitHub Pages using GitHub Actions.

## Project-Specific Notes (Deploymint Mini)

- Site URL: `https://acidyq.github.io/deploymint_mini`
- Pages type: Project Pages (base path `'/deploymint_mini/'`)
- Project type: Static Node.js application (Express API + vanilla HTML/CSS/JS frontend)
- Build: No build step required - serves static files directly from `public/` directory
- API: Runs on Express server (port 4000) - **Note: API will not work on GitHub Pages** (static hosting only)
- Deployment strategy: GitHub Pages will host the static frontend only; API features require local server

**Important**: Deploymint Mini is a local development tool designed to run on your machine. The GitHub Pages deployment serves documentation and demo purposes only. Server management features require running the Express API locally.

## Quick Decision Tree

- What type of site?
  - Static frontend (HTML/CSS/JS) → Deploy to GitHub Pages
  - API backend (Express server) → Cannot deploy to GitHub Pages (requires Node.js server)

- What Pages type?
  - User/Org Pages (repo named `<user>.github.io`) → Deployed at `https://<user>.github.io/` (base path `/`)
  - Project Pages (any repo name) → Deployed at `https://<user>.github.io/<repo>/` (base path `/<repo>/`)

- Deployment method:
  - GitHub Actions → Automated deployment on push to main branch

## One‑Time GitHub Setup

1. Create or open your repository on GitHub: `https://github.com/acidyq/deploymint_mini`
2. Go to: Repository → Settings → Pages
3. Under "Build and deployment", select "GitHub Actions"
4. Optional: Set a custom domain and enable "Enforce HTTPS"

## Project Pages Base Path

Since this site lives at `https://acidyq.github.io/deploymint_mini/`, the frontend must handle the base path `/deploymint_mini/`.

For this project:
- Static HTML: Update asset references in `public/index.html` to use base path
- API calls: Update fetch URLs to handle base path (or disable for GitHub Pages deployment)
- Icons/Images: Ensure paths start with `/deploymint_mini/` or use relative paths

## GitHub Actions Deployment Workflow

Place this workflow at `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Prepare static files
        run: |
          # Copy public directory to deployment folder
          mkdir -p _site
          cp -r public/* _site/

          # Add .nojekyll to prevent Jekyll processing
          touch _site/.nojekyll

          # Create info page about GitHub Pages limitations
          echo "⚠️ Note: API features require running the app locally. See README.md" > _site/GITHUB_PAGES_INFO.txt

      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./_site

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

## Configuration Updates Needed

Before deploying, update the following files to handle the base path:

### 1. Update `public/index.html`

Change asset references from:
```html
<link rel="icon" type="image/png" sizes="32x32" href="/favicon.png">
<img src="assets/icon.png" alt="Deploymint Mini emblem">
```

To:
```html
<link rel="icon" type="image/png" sizes="32x32" href="/deploymint_mini/favicon.png">
<img src="/deploymint_mini/assets/icon.png" alt="Deploymint Mini emblem">
```

Or use a `<base>` tag in the `<head>`:
```html
<base href="/deploymint_mini/">
```

### 2. Disable API Calls for Static Deployment

Since GitHub Pages cannot run the Express server, add a check to disable API features:

```javascript
const IS_GITHUB_PAGES = window.location.hostname.includes('github.io');

if (IS_GITHUB_PAGES) {
    showToast('⚠️ API features disabled. Clone the repo and run locally for full functionality.');
}
```

## Alternative: Serve Documentation Only

If you prefer to keep the app local-only, you can deploy just a documentation/landing page:

1. Create `docs/index.html` with project information, screenshots, and setup instructions
2. Update the workflow to deploy from `docs/` instead of `public/`
3. Link to the GitHub repository for downloading the actual app

## Local Development vs GitHub Pages

| Feature | Local (Express Server) | GitHub Pages |
|---------|------------------------|--------------|
| Frontend UI | ✅ Full functionality | ✅ Static view only |
| Server management | ✅ Start/stop servers | ❌ Not available |
| Server configuration | ✅ Save/load configs | ❌ Not available |
| Export/Import | ✅ Full support | ⚠️ View-only |
| Documentation | ✅ Access via localhost | ✅ Public access |

## Permissions and Security

- Required for Pages deploy via Actions: `pages: write`, `id-token: write`, `contents: read`
- Do not commit sensitive data (API keys, server paths, etc.) to the repository
- Use `.gitignore` to exclude `servers.json` if it contains private server information

## Troubleshooting

- **404 on assets**: Verify base path is correctly set (should be `/deploymint_mini/`)
- **API calls failing**: Expected on GitHub Pages; API requires local Node.js server
- **Workflow failed**: Check that Pages is enabled in Settings → Pages
- **Assets not loading**: Add `.nojekyll` file to prevent Jekyll from ignoring underscore-prefixed files
- **Base path issues**: Use browser DevTools to check actual asset paths being requested

## Verification Checklist

- [ ] Pages enabled in Settings with "GitHub Actions" as source
- [ ] Workflow file committed to `.github/workflows/deploy.yml`
- [ ] Base path `/deploymint_mini/` configured in HTML/assets
- [ ] `.nojekyll` file included in deployment
- [ ] README.md explains GitHub Pages limitations
- [ ] Local setup instructions documented for full functionality

## Recommended Approach

For **Deploymint Mini**, we recommend:

1. **Keep it local-first**: This is a development tool that requires a local Node.js server
2. **Use GitHub for source control**: Push code to repository for version control and sharing
3. **Deploy documentation to Pages** (optional): Create a landing page that explains the project and links to installation instructions
4. **Skip deploying the app itself**: GitHub Pages cannot run the Express API, making most features non-functional

---

Last updated: 2025-10-07
