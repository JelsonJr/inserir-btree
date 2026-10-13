/** Cores usadas pelo desenho da árvore (passadas explicitamente para que a exportação SVG/PNG preserve o tema). */
export interface TreePalette {
  background: string
  surface: string
  text: string
  muted: string
  border: string
  link: string
  primary: string
  accent: string
  success: string
  warning: string
  error: string
  info: string
}
