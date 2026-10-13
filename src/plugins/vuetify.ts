/**
 * plugins/vuetify.ts
 *
 * Framework documentation: https://vuetifyjs.com`
 */

// Styles
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

// Composables
import { createVuetify } from 'vuetify'
import { pt } from 'vuetify/locale'

export const THEME_STORAGE_KEY = 'btree-visualizer:theme'

export type ThemeName = 'light' | 'dark'

/** Cores dos temas, também usadas pelo desenho da árvore (exportável em SVG/PNG). */
export const THEME_COLORS = {
  light: {
    'background': '#F3F5FB',
    'surface': '#FFFFFF',
    'surface-variant': '#E6E9F4',
    'primary': '#4F46E5',
    'secondary': '#0891B2',
    'accent': '#9333EA',
    'success': '#16A34A',
    'warning': '#D97706',
    'error': '#DC2626',
    'info': '#0284C7',
  },
  dark: {
    'background': '#0B1020',
    'surface': '#131A2E',
    'surface-variant': '#1E2742',
    'primary': '#818CF8',
    'secondary': '#22D3EE',
    'accent': '#C084FC',
    'success': '#4ADE80',
    'warning': '#FBBF24',
    'error': '#F87171',
    'info': '#38BDF8',
  },
} as const satisfies Record<ThemeName, Record<string, string>>

function initialTheme (): ThemeName {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Armazenamento indisponível.
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
export default createVuetify({
  locale: {
    locale: 'pt',
    messages: { pt },
  },
  theme: {
    defaultTheme: initialTheme(),
    themes: {
      light: { dark: false, colors: THEME_COLORS.light },
      dark: { dark: true, colors: THEME_COLORS.dark },
    },
  },
  defaults: {
    VBtn: { style: 'text-transform: none; letter-spacing: normal;' },
    VTab: { style: 'text-transform: none; letter-spacing: normal;' },
  },
})
