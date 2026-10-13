import { fileURLToPath, URL } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import Vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    Vue({
      template: { transformAssetUrls },
    }),
    // Importa automaticamente apenas os componentes Vuetify usados.
    Vuetify({ autoImport: true }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('src', import.meta.url)),
    },
  },
  build: {
    target: 'es2023',
    rolldownOptions: {
      output: {
        // Bibliotecas em arquivos separados: mudam pouco e ficam em cache.
        codeSplitting: {
          groups: [
            { name: 'd3', test: /node_modules[\\/](d3|d3-[^\\/]+|internmap|delaunator|robust-predicates)[\\/]/ },
            { name: 'vuetify', test: /node_modules[\\/]vuetify[\\/]/ },
            { name: 'vue', test: /node_modules[\\/](@vue|vue|pinia)[\\/]/, priority: 2 },
          ],
        },
      },
    },
  },
  server: {
    port: 3000,
  },
})
