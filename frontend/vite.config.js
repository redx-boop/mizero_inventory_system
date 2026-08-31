import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react({
      // Enable automatic JSX runtime for smaller bundles
      jsxRuntime: 'automatic',
      // Fast Refresh disabled in production for performance
      fastRefresh: process.env.NODE_ENV !== 'production',
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'android-chrome-192x192.png', 'android-chrome-512x512.png'],
      manifest: {
        name: 'Mizero Inventory System',
        short_name: 'Mizero Inventory',
        description: 'Mizero Inventory Management System — Smart Department-Centered Inventory Intelligence',
        theme_color: '#8B9EFF',
        background_color: '#F1F4FD',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        id: '/',
        icons: [
          {
            src: 'android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        categories: ['business', 'productivity'],
        lang: 'en',
        dir: 'ltr',
        screenshots: [],
        prefer_related_applications: false,
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,woff,ttf}'],
        runtimeCaching: [
          {
            // Cache Google Fonts stylesheets
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          },
          {
            // Cache Google Fonts webfont files
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          },
          {
            // Cache images but NOT API responses
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ],
        // Skip waiting so new service worker activates immediately
        skipWaiting: true,
        // Claim all clients immediately
        clientsClaim: true,
        // Do NOT navigate fallback to index.html for API routes
        navigateFallbackDenylist: [/^\/api/],
        // Clean up old caches
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false
      }
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Target modern browsers for smaller bundle sizes
    target: 'es2020',
    // Enable minification
    minify: 'esbuild',
    // CSS code splitting off to reduce CSS file count
    cssCodeSplit: false,
    // Generate source maps only in dev
    sourcemap: false,
    // Warn about large chunks
    chunkSizeWarningLimit: 400,
    // Rollup-specific options
    rollupOptions: {
      output: {
        // Manual chunk splitting for optimal caching
        manualChunks: {
          // Core vendor — React, ReactDOM, Router
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // Chart.js — heavy, rarely changes
          charts: ['chart.js', 'react-chartjs-2'],
          // Icons — large package, split into own chunk
          icons: ['react-icons'],
          // PDF generation — rarely used, separate chunk
          pdf: ['jspdf', 'jspdf-autotable'],
          // HTTP client
          http: ['axios'],
        },
        // Compact output for smaller file names
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    // Increase asset inline limit for small assets
    assetsInlineLimit: 4096,
  },
  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'react-icons',
      'react-hot-toast',
    ],
    // Exclude heavy deps from pre-bundle (they'll be loaded on demand)
    exclude: ['chart.js', 'react-chartjs-2', 'jspdf', 'jspdf-autotable'],
  },
})
