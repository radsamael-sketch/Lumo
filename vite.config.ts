import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages project sites are served from /<repository>/.
// Local development and GitHub user/organization sites stay at /.
export default defineConfig(({ mode }) => {
  const githubRepository = loadEnv(mode, '.', '').GITHUB_REPOSITORY;
  const [githubOwner, githubRepo] = githubRepository?.split('/') ?? [];
  const isUserSite = Boolean(githubOwner && githubRepo === `${githubOwner}.github.io`);
  const base = githubRepo && !isUserSite ? `/${githubRepo}/` : '/';

  return ({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      base,
      includeAssets: ['lumo-mark.svg', 'lumo-icon-192.png', 'lumo-icon-512.png'],
      manifest: {
        name: 'LUMO English Learning Space',
        short_name: 'LUMO',
        description: 'Personal English learning planner and practice space',
        lang: 'ru',
        theme_color: '#f5f0e8',
        background_color: '#f5f0e8',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'lumo-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'lumo-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'lumo-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  });
});
