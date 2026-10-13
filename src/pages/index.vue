<template>
  <v-app-bar border="b" density="comfortable" flat>
    <template #prepend>
      <v-app-bar-nav-icon v-if="mobile" aria-label="Abrir painel" @click="drawer = !drawer" />
      <v-avatar v-if="!mobile" class="ml-2 brand" rounded="lg" size="36">
        <v-icon color="white" icon="mdi-file-tree" />
      </v-avatar>
    </template>
    <v-app-bar-title>
      <div class="d-flex flex-column">
        <span class="text-subtitle-1 font-weight-bold title-line">Árvore B</span>
        <span v-if="!mobile" class="text-caption text-medium-emphasis title-line">
          Visualizador interativo · Estrutura de Dados
        </span>
      </div>
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
            aria-label="Arquivo"
            icon="mdi-tray-arrow-down"
            title="Importar / exportar"
            variant="text"
            v-bind="menu"
          />
        </template>
        <v-list density="compact" min-width="220">
          <v-list-subheader>Exportar</v-list-subheader>
          <v-list-item :disabled="!hasTree" prepend-icon="mdi-image-outline" title="Imagem PNG" @click="downloadPng" />
          <v-list-item :disabled="!hasTree" prepend-icon="mdi-svg" title="Vetor SVG" @click="downloadSvg" />
          <v-list-item prepend-icon="mdi-code-json" title="Dados JSON" @click="downloadJson" />
          <v-divider class="my-1" />
          <v-list-subheader>Importar</v-list-subheader>
          <v-list-item prepend-icon="mdi-file-upload-outline" title="Abrir JSON…" @click="fileInput?.click()" />
          <template v-if="mobile">
            <v-divider class="my-1" />
            <v-list-item prepend-icon="mdi-help-circle-outline" title="Ajuda" @click="help = true" />
          </template>
        </v-list>
      </v-menu>
      <v-btn
        :aria-label="isDark ? 'Tema claro' : 'Tema escuro'"
        :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
        title="Alternar tema"
        variant="text"
        @click="toggleTheme"
      />
      <v-btn
        v-if="!mobile"
        aria-label="Ajuda"
        class="mr-1"
        icon="mdi-help-circle-outline"
        title="Ajuda"
        variant="text"
        @click="help = true"
      />
    </template>
  </v-app-bar>

  <v-navigation-drawer
    v-model="drawer"
    border="e"
    :permanent="!mobile"
    :temporary="mobile"
    width="370"
  >
    <ControlPanel ref="panel" v-model:key-value="keyValue" />
  </v-navigation-drawer>

  <v-main>
    <div class="page pa-3 pa-md-5">
      <StatsBar />

      <v-card border class="canvas-card" flat rounded="lg">
        <div class="canvas-header d-flex align-center ga-2 px-4 py-2">
          <v-icon color="primary" icon="mdi-graph-outline" size="small" />
          <span class="text-body-2 font-weight-medium">Ordem {{ store.order }}</span>
          <v-chip
            v-if="store.stepIndex >= 0"
            color="primary"
            label
            size="x-small"
            variant="flat"
          >
            Passo {{ store.stepIndex + 1 }}
          </v-chip>
          <v-spacer />
          <span class="text-caption text-medium-emphasis d-none d-sm-inline">
            Arraste para mover · role para zoom · clique numa chave para selecioná-la
          </span>
        </div>
        <v-divider />
        <TreeCanvas
          ref="canvas"
          :auto-fit="store.autoFit"
          class="canvas"
          :highlight="store.highlight"
          :palette="palette"
          :snapshot="store.displaySnapshot"
          @select-key="selectKey"
        />
      </v-card>

      <v-expand-transition>
        <PlaybackBar v-if="store.steps.length > 0" />
      </v-expand-transition>

      <InfoTabs />

      <footer class="text-center text-caption text-medium-emphasis py-2">
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
    location="bottom right"
    :timeout="3000"
    variant="tonal"
  >
    {{ snackbar.text }}
  </v-snackbar>

  <v-dialog v-model="help" max-width="560" scrollable>
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center ga-2 pt-4">
        <v-icon color="primary" icon="mdi-help-circle-outline" /> Como usar
      </v-card-title>
      <v-card-text>
        <v-list density="compact" lines="two">
          <v-list-item
            v-for="h in helpItems"
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
          <div><kbd>Espaço</kbd> reproduzir/pausar · <kbd>←</kbd> <kbd>→</kbd> navegar nos passos (fora dos campos)</div>
          <div><kbd>F</kbd> enquadrar a árvore</div>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" variant="flat" @click="help = false">Entendi</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
  import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
  import { useDisplay, useTheme } from 'vuetify'
  import TreeCanvas from '@/components/TreeCanvas.vue'
  import type { TreePalette } from '@/components/types'
  import ControlPanel from '@/components/ControlPanel.vue'
  import { THEME_STORAGE_KEY } from '@/plugins/vuetify'
  import { type LogLevel, useBTreeStore } from '@/stores/btree'

  const store = useBTreeStore()
  const theme = useTheme()
  const { mobile } = useDisplay()

  const drawer = ref(!mobile.value)
  const help = ref(false)
  const keyValue = ref<string | number | null>(null)
  const canvas = ref<InstanceType<typeof TreeCanvas> | null>(null)
  const panel = ref<InstanceType<typeof ControlPanel> | null>(null)
  const fileInput = ref<HTMLInputElement | null>(null)
  const snackbar = reactive({ show: false, text: '', color: 'info' as LogLevel })

  const isDark = computed(() => theme.global.current.value.dark)
  const hasTree = computed(() => store.stats.size > 0)

  const palette = computed<TreePalette>(() => {
    const c = theme.global.current.value.colors
    const dark = isDark.value
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

  const helpItems = [
    { icon: 'mdi-plus-circle-outline', title: 'Inserir, buscar e remover', text: 'Digite um valor e use os botões. Cada operação é animada passo a passo.' },
    { icon: 'mdi-layers-triple-outline', title: 'Em lote', text: 'Insira listas, chaves aleatórias ou sequências inteiras de uma vez.' },
    { icon: 'mdi-tune-variant', title: 'Ordem', text: 'Mude a ordem (3 a 10) para ver como nós maiores reduzem a altura.' },
    { icon: 'mdi-play-circle-outline', title: 'Reprodução', text: 'Pause, avance ou volte os passos da última operação na barra abaixo da árvore.' },
    { icon: 'mdi-rocket-launch-outline', title: 'Benchmark', text: 'Mede inserção, busca e remoção com até 1 milhão de chaves.' },
    { icon: 'mdi-content-save-outline', title: 'Salvo automaticamente', text: 'A árvore fica salva no navegador; exporte em PNG, SVG ou JSON.' },
  ]

  function toggleTheme () {
    const next = isDark.value ? 'light' : 'dark'
    theme.global.name.value = next
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Armazenamento indisponível.
    }
  }

  function selectKey (key: number) {
    keyValue.value = key
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
    if (typing || mod || event.altKey) return

    switch (event.key) {
      case ' ':
        if (store.steps.length === 0 || target?.tagName === 'BUTTON') return
        event.preventDefault()
        if (store.playing) store.pause()
        else store.play()
        break
      case 'ArrowRight':
        if (store.steps.length) store.nextStep()
        break
      case 'ArrowLeft':
        if (store.steps.length) store.prevStep()
        break
      case 'f':
      case 'F':
        canvas.value?.fit(true)
        break
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.brand {
  background: linear-gradient(135deg, rgb(var(--v-theme-primary)), rgb(var(--v-theme-accent)));
}

.title-line {
  line-height: 1.2;
}

.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1600px;
  margin: 0 auto;
}

.canvas-card {
  display: flex;
  flex-direction: column;
  height: clamp(380px, calc(100vh - 330px), 900px);
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
