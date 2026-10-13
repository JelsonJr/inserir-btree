<template>
  <v-sheet border class="playback" elevation="6" rounded="xl">
    <div class="d-flex align-center ga-1 px-2 pt-2">
      <v-btn
        aria-label="Passo anterior"
        density="comfortable"
        :disabled="store.stepIndex === 0"
        icon="mdi-skip-previous"
        size="small"
        title="Passo anterior (←)"
        variant="text"
        @click="store.prevStep()"
      />
      <v-btn
        :aria-label="store.playing ? 'Pausar' : 'Reproduzir'"
        color="primary"
        density="comfortable"
        :icon="store.playing ? 'mdi-pause' : (atEnd ? 'mdi-replay' : 'mdi-play')"
        size="small"
        :title="store.playing ? 'Pausar (Espaço)' : 'Reproduzir (Espaço)'"
        variant="flat"
        @click="store.playing ? store.pause() : store.play()"
      />
      <v-btn
        aria-label="Próximo passo"
        density="comfortable"
        :disabled="atEnd"
        icon="mdi-skip-next"
        size="small"
        title="Próximo passo (→)"
        variant="text"
        @click="store.nextStep()"
      />

      <div class="message d-flex align-center ga-2 px-2">
        <v-icon :color="meta.color" :icon="meta.icon" size="18" />
        <span class="text-body-2 text-truncate" :title="message">{{ message }}</span>
      </div>

      <v-menu location="top">
        <template #activator="{ props: menu }">
          <v-btn
            v-bind="menu"
            class="speed"
            density="comfortable"
            size="small"
            title="Velocidade"
            variant="tonal"
          >
            {{ store.speed }}×
          </v-btn>
        </template>
        <v-list density="compact">
          <v-list-item
            v-for="s in SPEEDS"
            :key="s"
            :active="store.speed === s"
            :title="`${s}×`"
            @click="store.setSpeed(s)"
          />
        </v-list>
      </v-menu>
      <v-btn
        aria-label="Ir para o resultado"
        density="comfortable"
        :disabled="atEnd"
        icon="mdi-page-last"
        size="small"
        title="Ir para o resultado"
        variant="text"
        @click="store.skipPlayback()"
      />
    </div>

    <v-slider
      class="timeline px-4"
      color="primary"
      density="compact"
      hide-details
      :max="total"
      :min="1"
      :model-value="position"
      :step="1"
      thumb-size="12"
      track-size="3"
      @update:model-value="onScrub"
    />
  </v-sheet>
</template>

<script lang="ts" setup>
  import type { StepKind } from '@/lib/btree'
  import { computed } from 'vue'
  import { useBTreeStore } from '@/stores/btree'

  const store = useBTreeStore()
  const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4]

  const total = computed(() => store.steps.length)
  const atEnd = computed(() => store.stepIndex < 0 || store.stepIndex === total.value - 1)
  /** Posição na linha do tempo (1..n); o resultado final conta como o último passo. */
  const position = computed(() => store.stepIndex < 0 ? total.value : store.stepIndex + 1)

  const message = computed(() => store.currentStep?.message
    ?? `Resultado final · ${total.value} passo(s)`)

  const META: Record<StepKind, { icon: string, color: string }> = {
    'visit': { icon: 'mdi-eye-outline', color: 'info' },
    'insert': { icon: 'mdi-plus-circle-outline', color: 'success' },
    'overflow': { icon: 'mdi-alert-octagon-outline', color: 'error' },
    'split': { icon: 'mdi-call-split', color: 'primary' },
    'new-root': { icon: 'mdi-arrow-up-bold-circle-outline', color: 'primary' },
    'duplicate': { icon: 'mdi-content-duplicate', color: 'warning' },
    'found': { icon: 'mdi-check-circle-outline', color: 'success' },
    'not-found': { icon: 'mdi-close-circle-outline', color: 'error' },
    'remove': { icon: 'mdi-minus-circle-outline', color: 'primary' },
    'replace': { icon: 'mdi-swap-horizontal', color: 'primary' },
    'borrow': { icon: 'mdi-hand-coin-outline', color: 'primary' },
    'merge': { icon: 'mdi-call-merge', color: 'primary' },
    'shrink': { icon: 'mdi-arrow-collapse-up', color: 'primary' },
  }

  const meta = computed(() => store.currentStep ? META[store.currentStep.kind] : { icon: 'mdi-flag-checkered', color: 'success' })

  function onScrub (value: number) {
    store.seek(Math.round(value) - 1)
  }
</script>

<style scoped>
.playback {
  width: min(720px, 100%);
  background: rgba(var(--v-theme-surface), 0.94);
  backdrop-filter: blur(8px);
}

.message {
  flex: 1 1 auto;
  min-width: 0;
}

.speed {
  min-width: 52px;
  font-variant-numeric: tabular-nums;
}

.timeline {
  margin-top: -2px;
  margin-bottom: 2px;
}
</style>
