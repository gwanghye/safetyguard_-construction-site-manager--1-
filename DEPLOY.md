# Deployment Guide

This project is a Vite React application. You can deploy it to various platforms.

## GitHub Pages (Recommended)

This project includes a GitHub Actions workflow to automatically deploy to GitHub Pages.

1.  **Push to GitHub**: Push your code to a GitHub repository.
2.  **Enable GitHub Pages**:
    *   Go to your repository **Settings**.
    *   Click on **Pages** in the sidebar.
    *   Under **Build and deployment**, select **GitHub Actions** as the source.
3.  **Update `vite.config.ts`**:
    *   If your repository is at `https://<USERNAME>.github.io/<REPO>/`, you must set the `base` in `vite.config.ts`:
        ```typescript
        export default defineConfig({
          base: '/<REPO>/', // Replace <REPO> with your repository name
          // ... other config
        })
        ```
4.  **Trigger Deployment**:
    *   Push a change to the `main` branch.
    *   The "Deploy to GitHub Pages" action will run automatically.

## Vercel

1.  Go to [Vercel](https://vercel.com) and sign up/login.
2.  Click **Add New...** > **Project**.
3.  Import your GitHub repository.
4.  Vercel will automatically detect Vite. Click **Deploy**.

## Netlify

1.  Go to [Netlify](https://netlify.com) and sign up/login.
2.  Click **Add new site** > **Import an existing project**.
3.  Connect to GitHub and select your repository.
4.  Netlify will automatically detect the build settings (`vite build` and `dist`). Click **Deploy**.
