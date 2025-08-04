import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      minify: false, // Faster builds in development
      sourcemap: true, // Better debugging
      rollupOptions: {
        external: ['electron']
      }
    },
    define: {
      __dirname: '__dirname',
      __filename: '__filename'
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      minify: false, // Faster builds in development
      sourcemap: true, // Better debugging
      rollupOptions: {
        external: ['electron'],
        output: {
          // Force .cjs extension for preload scripts to ensure CommonJS loading
          entryFileNames: 'index.cjs',
          format: 'cjs' // Use CommonJS format for preload scripts
        }
      }
    },
    define: {
      __dirname: '__dirname',
      __filename: '__filename'
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src'),
        '@main': resolve('src/main'),
        '@preload': resolve('src/preload')
      }
    },
    plugins: [
      react({
        // Fast refresh for better development experience
        fastRefresh: true,
        // Optimize babel transforms
        babel: {
          babelrc: false,
          configFile: false,
        }
      })
    ],
    css: {
      postcss: './postcss.config.js',
      devSourcemap: true // CSS sourcemaps for debugging
    },
    define: {
      global: 'globalThis',
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
    },
    // Development server optimizations
    server: {
      hmr: {
        overlay: false // Disable error overlay for better UX
      }
    },
    // Build optimizations
    build: {
      sourcemap: true,
      // Chunk splitting for better caching
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            mui: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
            utils: ['zustand', 'highlight.js']
          }
        }
      }
    }
  }
})