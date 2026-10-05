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
      '/proxy/users': {
        target: 'https://users.roblox.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/users/, '')
      },
      '/proxy/thumbnails': {
        target: 'https://thumbnails.roblox.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/thumbnails/, '')
      },
      '/proxy/friends': {
        target: 'https://friends.roblox.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/friends/, '')
      },
      '/proxy/inventory': {
        target: 'https://inventory.roblox.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/inventory/, '')
      },
      '/proxy/avatar': {
        target: 'https://avatar.roblox.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/avatar/, '')
      },
      '/proxy/economy': {
        target: 'https://economy.roblox.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/economy/, '')
      }
    }
  }
})
