import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    proxy: {
      '/api/users': {
        target: 'https://users.roblox.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/users/, '')
      },
      '/api/thumbnails': {
        target: 'https://thumbnails.roblox.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/thumbnails/, '')
      },
      '/api/friends': {
        target: 'https://friends.roblox.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/friends/, '')
      },
      '/api/inventory': {
        target: 'https://inventory.roblox.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/inventory/, '')
      },
      '/api/avatar': {
        target: 'https://avatar.roblox.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/avatar/, '')
      },
      '/api/economy': {
        target: 'https://economy.roblox.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/economy/, '')
      }
    }
  }
})
