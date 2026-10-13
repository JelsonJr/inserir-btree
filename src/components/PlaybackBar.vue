<template>
  <v-card border class="playback" flat rounded="lg">
    <div class="d-flex align-center flex-wrap ga-3 pa-3">
      <div class="d-flex align-center ga-1">
        <v-btn
          aria-label="Passo anterior"
          :disabled="store.stepIndex === 0"
          icon="mdi-skip-previous"
          size="small"
          variant="text"
          @click="store.prevStep()"
        />
        <v-btn
          :aria-label="store.playing ? 'Pausar' : 'Reproduzir'"
          color="primary"
          :icon="store.playing ? 'mdi-pause' : 'mdi-play'"
          size="small"
          variant="flat"
          @click="store.playing ? store.pause() : store.play()"
        />
        <v-btn
          aria-label="Próximo passo"
          :disabled="store.stepIndex === total - 1"
          icon="mdi-skip-next"
          size="small"
          variant="text"
          @click="store.nextStep()"
        />
        <v-btn
          aria-label="Ir para o resultado"
          :disabled="store.stepIndex < 0"
          icon="mdi-page-last"
          size="small"
          variant="text"
          @click="store.skipPlayback()"
        />
      </div>

      <div class="message d-flex align-center ga-2">
        <v-icon :color="meta.color" :icon="meta.icon" size="20" />
        <span class="text-body-2">
          <template v-if="step">{{ step.message }}</template>
          <template v-else>Resultado final — {{ total }} passo(s). Use ▶ para rever a operação.</template>
        </span>
      </div>

      <v-chip class="ml-auto" label size="small" variant="tonal">
        {{ store.stepIndex >= 0 ? store.stepIndex + 1 : total }} / {{ total }}
      </v-chip>
    </div>
    <v-progress-linear
      color="primary"
      height="3"
      :model-value="progress"
    />
  </v-card>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import type { StepKind } from '@/lib/btree'
  import { useBTreeStore } from '@/stores/btree'

  const store = useBTreeStore()

  const step = computed(() => store.currentStep)
  const total = computed(() => store.steps.length)
  const progress = computed(() => store.stepIndex < 0 ? 100 : ((store.stepIndex + 1) / total.value) * 100)

  const META: Record<StepKind, { icon: string, color: string }> = {
    visit: { icon: 'mdi-eye-outline', color: 'info' },
    insert: { icon: 'mdi-plus-circle-outline', color: 'success' },
    overflow: { icon: 'mdi-alert-octagon-outline', color: 'error' },
    split: { icon: 'mdi-call-split', color: 'primary' },
    'new-root': { icon: 'mdi-arrow-up-bold-circle-outline', color: 'primary' },
    duplicate: { icon: 'mdi-content-duplicate', color: 'warning' },
    found: { icon: 'mdi-check-circle-outline', color: 'success' },
    'not-found': { icon: 'mdi-close-circle-outline', color: 'error' },
    remove: { icon: 'mdi-minus-circle-outline', color: 'primary' },
    replace: { icon: 'mdi-swap-horizontal', color: 'primary' },
    borrow: { icon: 'mdi-hand-coin-outline', color: 'primary' },
    merge: { icon: 'mdi-call-merge', color: 'primary' },
    shrink: { icon: 'mdi-arrow-collapse-up', color: 'primary' },
  }

  const meta = computed(() => step.value ? META[step.value.kind] : { icon: 'mdi-flag-checkered', color: 'success' })
</script>

<style scoped>
.message {
  flex: 1 1 260px;
  min-width: 0;
}
</style>
