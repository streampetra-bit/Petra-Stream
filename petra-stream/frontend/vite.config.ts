import { defineConfig } from 'vite'

// Use async config and dynamic import so ESM-only plugins load properly
export default defineConfig(async () => {
  const reactPlugin = (await import('@vitejs/plugin-react')).default

  return {
    plugins: [reactPlugin()],
    server: {
      port: 5173,
      host: true,
    },
    resolve: {
      alias: {
        // optional helpful alias
        '@': '/src',
      },
    },
  }
})
