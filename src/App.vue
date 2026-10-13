<template>
  <v-app>
    <v-app-bar border="b" density="compact" flat>
      <template #prepend>
        <v-btn
          :aria-label="panelOpen ? 'Recolher painel' : 'Expandir painel'"
          :icon="panelOpen && !mobile ? 'mdi-menu-open' : 'mdi-menu'"
          :title="`${panelOpen ? 'Recolher' : 'Expandir'} painel ([)`"
          variant="text"
          @click="togglePanel"
        />
      </template>
      <v-app-bar-title>
        <span class="font-weight-bold">Árvore B</span>
        <span v-if="!mobile" class="text-body-2 text-medium-emphasis ml-2">visualizador interativo</span>
      </v-app-bar-title>

      <template #append>
        <v-btn
          aria-label="Desfazer"
          :disabled="!store.canUndo"
          icon="mdi-undo"
          title="Desfazer (Ctrl+Z)"
          variant="text"
          @click="store.undo()"
        />
        <v-btn
          aria-label="Refazer"
          :disabled="!store.canRedo"
          icon="mdi-redo"
          title="Refazer (Ctrl+Y)"
          variant="text"
          @click="store.redo()"
        />
        <v-menu location="bottom end">
          <template #activator="{ props: menu }">
            <v-btn
              v-bind="menu"
              aria-label="Mais opções"
              class="mr-1"
              icon="mdi-dots-vertical"
              title="Mais opções"
              variant="text"
            />
          </template>
          <v-list density="compact" min-width="230">
            <v-list-subheader>Arquivo</v-list-subheader>
            <v-list-item :disabled="!hasTree" prepend-icon="mdi-image-outline" title="Exportar PNG" @click="downloadPng" />
            <v-list-item :disabled="!hasTree" prepend-icon="mdi-svg" title="Exportar SVG" @click="downloadSvg" />
            <v-list-item prepend-icon="mdi-code-json" title="Exportar JSON" @click="downloadJson" />
            <v-list-item prepend-icon="mdi-file-upload-outline" title="Importar JSON…" @click="fileInput?.click()" />
            <v-divider class="my-1" />
            <v-list-item
              :prepend-icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
              :title="isDark ? 'Tema claro' : 'Tema escuro'"
              @click="toggleTheme"
            />
            <v-list-item prepend-icon="mdi-help-circle-outline" title="Ajuda e atalhos" @click="help = true" />
          </v-list>
        </v-menu>
      </template>
    </v-app-bar>

    <v-navigation-drawer
      v-model="drawer"
      border="e"
      :permanent="!mobile"
      :rail="!mobile && rail"
      rail-width="60"
      :temporary="mobile"
      width="340"
    >
      <ControlPanel
        ref="panel"
        v-model:key-value="keyValue"
        v-model:section="section"
        :rail="!mobile && rail"
        @expand="expandTo"
      />
      <template v-if="!mobile" #append>
        <v-divider />
        <div class="d-flex pa-2" :class="rail ? 'justify-center' : 'justify-end'">
          <v-btn
            :aria-label="rail ? 'Expandir painel' : 'Recolher painel'"
            :icon="rail ? 'mdi-chevron-double-right' : 'mdi-chevron-double-left'"
            size="small"
            :title="`${rail ? 'Expandir' : 'Recolher'} painel ([)`"
            variant="text"
            @click="togglePanel"
          />
        </div>
      </template>
    </v-navigation-drawer>

    <v-main>
      <div class="page pa-3 pa-md-4">
        <v-card border class="canvas-card" flat rounded="lg">
          <div class="d-flex align-center flex-wrap ga-3 px-4 py-2">
            <v-chip color="primary" label size="small" variant="tonal">Ordem {{ store.order }}</v-chip>
            <StatsBar />
          </div>
          <v-divider />
          <TreeCanvas
            ref="canvas"
            :auto-fit="store.autoFit"
            class="canvas"
            :duration="store.transitionMs"
            :highlight="store.highlight"
            :palette="palette"
            :snapshot="store.displaySnapshot"
            @select-key="selectKey"
          >
            <template #bottom>
              <v-slide-y-reverse-transition>
                <PlaybackBar v-if="store.steps.length > 0" />
              </v-slide-y-reverse-transition>
            </template>
          </TreeCanvas>
        </v-card>

        <InfoTabs />

        <footer class="text-center text-caption text-medium-emphasis py-1">
          Trabalho final de Estrutura de Dados — feito por
          <strong>Jelson</strong>, <strong>Lucas</strong>, <strong>Matheus</strong> e <strong>Thais</strong>
        </footer>
      </div>
    </v-main>

    <input
      ref="fileInput"
      accept="application/json,.json"
      class="d-none"
      type="file"
      @change="onFile"
    >

    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      location="top right"
      :timeout="3000"
      variant="tonal"
    >
      {{ snackbar.text }}
    </v-snackbar>

    <v-dialog v-model="help" max-width="560" scrollable>
      <v-card rounded="lg">
        <v-card-title class="pt-4">Como usar</v-card-title>
        <v-card-text>
          <v-list density="compact" lines="two">
            <v-list-item
              v-for="h in HELP_ITEMS"
              :key="h.title"
              :prepend-icon="h.icon"
              :subtitle="h.text"
              :title="h.title"
            />
          </v-list>
          <v-divider class="my-3" />
          <div class="text-subtitle-2 mb-2">Atalhos</div>
          <div class="d-flex flex-column ga-1 text-body-2">
            <div><kbd>Enter</kbd> inserir · <kbd>Shift</kbd>+<kbd>Enter</kbd> buscar</div>
            <div><kbd>Ctrl</kbd>+<kbd>Z</kbd> desfazer · <kbd>Ctrl</kbd>+<kbd>Y</kbd> refazer</div>
            <div><kbd>Espaço</kbd> reproduzir/pausar · <kbd>←</kbd> <kbd>→</kbd> passo anterior/próximo</div>
            <div><kbd>Home</kbd> / <kbd>End</kbd> primeiro passo / resultado final</div>
            <div><kbd>F</kbd> enquadrar a árvore · <kbd>[</kbd> recolher/expandir o painel · <kbd>Esc</kbd> sair do campo de valor</div>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" variant="flat" @click="help = false">Entendi</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<script lang="ts" setup>
  import type { PanelSection, TreePalette } from '@/components/types'
  import type { LogLevel } from '@/stores/btree'
  import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
  import { useDisplay, useTheme } from 'vuetify'
  import ControlPanel from '@/components/ControlPanel.vue'
  import InfoTabs from '@/components/InfoTabs.vue'
  import PlaybackBar from '@/components/PlaybackBar.vue'
  import StatsBar from '@/components/StatsBar.vue'
  import TreeCanvas from '@/components/TreeCanvas.vue'
  import { THEME_COLORS, THEME_STORAGE_KEY } from '@/plugins/vuetify'
  import { useBTreeStore } from '@/stores/btree'

  const PANEL_STORAGE_KEY = 'btree-visualizer:panel'

  const HELP_ITEMS = [
    { icon: 'mdi-plus-circle-outline', title: 'Inserir, buscar e remover', text: 'Digite um valor no painel. Cada operação é animada passo a passo.' },
    { icon: 'mdi-play-circle-outline', title: 'Reprodução', text: 'Pause, arraste a linha do tempo, avance ou volte passos e mude a velocidade.' },
    { icon: 'mdi-layers-outline', title: 'Inserção em lote', text: 'Insira listas, chaves aleatórias ou sequências de uma vez.' },
    { icon: 'mdi-tune-variant', title: 'Ordem e animação', text: 'Mude a ordem (3 a 10) e ajuste velocidade e reprodução automática.' },
    { icon: 'mdi-speedometer', title: 'Benchmark', text: 'Mede inserção, busca e remoção com até 1 milhão de chaves.' },
    { icon: 'mdi-content-save-outline', title: 'Salvo automaticamente', text: 'A árvore fica salva no navegador; exporte em PNG, SVG ou JSON.' },
  ]

  const store = useBTreeStore()
  const theme = useTheme()
  const { mobile } = useDisplay()

  const savedPanel = readPanelState()
  const drawer = ref(!mobile.value)
  /** Painel recolhido (só ícones) no desktop. */
  const rail = ref(savedPanel.rail)
  /** Seção aberta no acordeão do painel. */
  const section = ref<PanelSection | null>(savedPanel.section)
  const panelOpen = computed(() => mobile.value ? drawer.value : !rail.value)

  const help = ref(false)
  const keyValue = ref<string | number | null>(null)
  const canvas = ref<InstanceType<typeof TreeCanvas> | null>(null)
  const panel = ref<InstanceType<typeof ControlPanel> | null>(null)
  const fileInput = ref<HTMLInputElement | null>(null)
  const snackbar = reactive({ show: false, text: '', color: 'info' as LogLevel })

  const isDark = computed(() => theme.global.current.value.dark)
  const hasTree = computed(() => store.stats.size > 0)

  const palette = computed<TreePalette>(() => {
    const dark = isDark.value
    const c = THEME_COLORS[dark ? 'dark' : 'light']
    return {
      background: c.background,
      surface: c.surface,
      text: dark ? '#E6E9F5' : '#1B2037',
      muted: dark ? '#8A93B5' : '#7A84A3',
      border: dark ? '#3A4568' : '#B9C1DA',
      link: dark ? '#4C5880' : '#A9B3CF',
      primary: c.primary,
      accent: c.accent,
      success: c.success,
      warning: c.warning,
      error: c.error,
      info: c.info,
    }
  })

  // ---- Painel -------------------------------------------------------------

  function readPanelState (): { rail: boolean, section: PanelSection | null } {
    try {
      const data = JSON.parse(localStorage.getItem(PANEL_STORAGE_KEY) ?? '{}')
      return { rail: data.rail === true, section: data.section === undefined ? 'settings' : data.section }
    } catch {
      return { rail: false, section: 'settings' }
    }
  }

  watch([rail, section], () => {
    try {
      localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify({ rail: rail.value, section: section.value }))
    } catch {
      // Armazenamento indisponível.
    }
  })

  function togglePanel () {
    if (mobile.value) drawer.value = !drawer.value
    else rail.value = !rail.value
  }

  /** Expande o painel recolhido já na seção clicada. */
  function expandTo (target: PanelSection) {
    rail.value = false
    drawer.value = true
    if (target === 'operation') panel.value?.focus()
    else section.value = target
  }

  function toggleTheme () {
    const next = isDark.value ? 'light' : 'dark'
    theme.change(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Armazenamento indisponível.
    }
  }

  function selectKey (key: number) {
    keyValue.value = key
    if (!mobile.value && rail.value) rail.value = false
    panel.value?.focus()
  }

  // ---- Arquivos -----------------------------------------------------------

  function download (blob: Blob, name: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const fileName = (ext: string) => `arvore-b-ordem-${store.order}.${ext}`

  function downloadJson () {
    download(new Blob([store.exportJson()], { type: 'application/json' }), fileName('json'))
  }

  function downloadSvg () {
    const markup = canvas.value?.exportSvg()
    if (markup) download(new Blob([markup], { type: 'image/svg+xml' }), fileName('svg'))
    else store.addLog('warning', 'Nada para exportar.')
  }

  async function downloadPng () {
    const blob = await canvas.value?.exportPng()
    if (blob) download(blob, fileName('png'))
    else store.addLog('error', 'Não foi possível gerar a imagem.')
  }

  async function onFile (event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (file.size > 20 * 1024 * 1024) {
      store.addLog('error', 'Arquivo muito grande (limite de 20 MB).')
      return
    }
    store.importJson(await file.text())
  }

  // ---- Avisos -------------------------------------------------------------

  watch(() => store.log[0], entry => {
    if (!entry || entry.level === 'success' || entry.level === 'info') return
    snackbar.text = entry.text
    snackbar.color = entry.level
    snackbar.show = true
  })

  // ---- Atalhos de teclado -------------------------------------------------

  function onKeydown (event: KeyboardEvent) {
    const target = event.target as HTMLElement | null
    const typing = !!target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    const mod = event.ctrlKey || event.metaKey

    if (mod && !event.altKey && event.key.toLowerCase() === 'z' && !typing) {
      event.preventDefault()
      if (event.shiftKey) store.redo()
      else store.undo()
      return
    }
    if (mod && event.key.toLowerCase() === 'y' && !typing) {
      event.preventDefault()
      store.redo()
      return
    }
    // Esc sai do campo de texto, liberando os atalhos de teclado.
    if (typing && event.key === 'Escape') {
      target?.blur()
      return
    }
    if (typing || mod || event.altKey) return

    const hasSteps = store.steps.length > 0
    switch (event.key) {
      case ' ': {
        if (!hasSteps || target?.tagName === 'BUTTON') return
        event.preventDefault()
        if (store.playing) store.pause()
        else store.play()
        break
      }
      case 'ArrowRight': {
        if (hasSteps) store.nextStep()
        break
      }
      case 'ArrowLeft': {
        if (hasSteps) store.prevStep()
        break
      }
      case 'Home': {
        if (hasSteps) store.seek(0)
        break
      }
      case 'End': {
        if (hasSteps) store.skipPlayback()
        break
      }
      case 'f':
      case 'F': {
        canvas.value?.fit(true)
        break
      }
      case '[': {
        togglePanel()
        break
      }
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 1600px;
  margin: 0 auto;
}

.canvas-card {
  display: flex;
  flex-direction: column;
  height: clamp(420px, calc(100dvh - 140px), 960px);
}

.canvas {
  flex: 1 1 auto;
  min-height: 0;
}

kbd {
  font-size: 0.8em;
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.25);
}
</style>
