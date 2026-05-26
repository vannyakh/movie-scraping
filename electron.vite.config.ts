import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

const sharedAlias = resolve(__dirname, 'src/shared')

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': sharedAlias } },
    build: {
      // @ts-expect-error electron-vite v5 BuildEnvironmentOptions doesn't expose rollupOptions type
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': sharedAlias } },
    build: {
      // @ts-expect-error electron-vite v5 BuildEnvironmentOptions doesn't expose rollupOptions type
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload.ts') },
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      // @ts-expect-error electron-vite v5 BuildEnvironmentOptions doesn't expose outDir type
      outDir: resolve(__dirname, 'out/renderer'),
    },
    resolve: {
      alias: {
        '@':      resolve(__dirname, 'src/renderer'),
        '@shared': sharedAlias,
      },
    },
    plugins: [react()],
  },
})
