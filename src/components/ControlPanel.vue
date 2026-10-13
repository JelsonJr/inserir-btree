<template>
  <!-- Modo recolhido: só ícones; clicar expande o painel na seção correspondente. -->
  <div v-if="rail" class="d-flex flex-column align-center ga-1 py-3">
    <v-btn
      v-for="s in SECTIONS"
      :key="s.value"
      :aria-label="s.title"
      :icon="s.icon"
      rounded="lg"
      :title="s.title"
      variant="text"
      @click="emit('expand', s.value)"
    />
  </div>

  <div v-else class="panel">
    <!-- Operação individual: sempre visível -->
    <section class="px-4 pt-4 pb-3">
      <div class="label mb-2">Operação</div>
      <v-text-field
        ref="keyField"
        v-model="key"
        autofocus
        clearable
        density="comfortable"
        hide-details
        placeholder="Valor"
        prepend-inner-icon="mdi-pound"
        type="number"
        variant="outlined"
        @keydown.enter.exact.prevent="doInsert"
        @keydown.enter.shift.prevent="doSearch"
      />
      <div class="d-flex ga-2 mt-3">
        <v-btn class="flex-grow-1" color="primary" prepend-icon="mdi-plus" variant="flat" @click="doInsert">
          Inserir
        </v-btn>
        <v-btn aria-label="Buscar" icon="mdi-magnify" rounded="lg" title="Buscar (Shift+Enter)" variant="tonal" @click="doSearch" />
        <v-btn aria-label="Remover" color="error" icon="mdi-minus" rounded="lg" title="Remover" variant="tonal" @click="doRemove" />
      </div>
      <div class="d-flex flex-wrap align-center ga-1 mt-3 text-caption text-medium-emphasis">
        <span class="mr-1">Exemplos:</span>
        <v-chip v-for="preset in PRESETS" :key="preset.label" size="small" variant="text" @click="preset.run">
          {{ preset.label }}
        </v-chip>
      </div>
    </section>

    <v-divider />

    <v-expansion-panels v-model="open" class="panels" flat static variant="accordion">
      <!-- Lote -->
      <v-expansion-panel value="bulk">
        <v-expansion-panel-title>
          <v-icon class="mr-3" icon="mdi-layers-outline" size="small" />
          Inserção em lote
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-btn-toggle
            v-model="bulkMode"
            class="mb-3 w-100"
            color="primary"
            density="compact"
            divided
            mandatory
            rounded="lg"
            variant="outlined"
          >
            <v-btn class="flex-grow-1" value="list">Lista</v-btn>
            <v-btn class="flex-grow-1" value="random">Aleatório</v-btn>
            <v-btn class="flex-grow-1" value="sequence">Sequência</v-btn>
          </v-btn-toggle>

          <template v-if="bulkMode === 'list'">
            <v-textarea
              v-model="listText"
              auto-grow
              density="compact"
              hide-details
              placeholder="Ex.: 50, 20, 80, 10, 30"
              rows="2"
              variant="outlined"
            />
            <v-btn block class="mt-2" :disabled="!listText.trim()" variant="tonal" @click="doInsertList">
              Inserir lista
            </v-btn>
          </template>

          <template v-else-if="bulkMode === 'random'">
            <div class="fields-3">
              <v-text-field v-model.number="random.count" density="compact" hide-details label="Qtd." min="1" type="number" variant="outlined" />
              <v-text-field v-model.number="random.min" density="compact" hide-details label="Mín." type="number" variant="outlined" />
              <v-text-field v-model.number="random.max" density="compact" hide-details label="Máx." type="number" variant="outlined" />
            </div>
            <div class="d-flex ga-2 mt-2">
              <v-btn class="flex-grow-1" variant="tonal" @click="doRandom">Inserir</v-btn>
              <v-btn class="flex-grow-1" color="error" variant="text" @click="store.removeRandom(num(random.count, 1))">Remover</v-btn>
            </div>
          </template>

          <template v-else>
            <div class="fields-3">
              <v-text-field v-model.number="seq.from" density="compact" hide-details label="De" type="number" variant="outlined" />
              <v-text-field v-model.number="seq.to" density="compact" hide-details label="Até" type="number" variant="outlined" />
              <v-text-field v-model.number="seq.step" density="compact" hide-details label="Passo" min="1" type="number" variant="outlined" />
            </div>
            <v-btn
              block
              class="mt-2"
              variant="tonal"
              @click="store.insertSequence(num(seq.from, 1), num(seq.to, 20), num(seq.step, 1))"
            >
              Inserir sequência
            </v-btn>
          </template>
        </v-expansion-panel-text>
      </v-expansion-panel>

      <!-- Árvore e animação -->
      <v-expansion-panel value="settings">
        <v-expansion-panel-title>
          <v-icon class="mr-3" icon="mdi-tune-variant" size="small" />
          Ordem e animação
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div class="d-flex justify-space-between text-body-2 mb-1">
            <span>Ordem <strong>{{ orderDraft }}</strong></span>
            <span class="text-medium-emphasis">{{ orderDraft - 1 }} chave(s) máx. · {{ Math.ceil(orderDraft / 2) - 1 }} mín.</span>
          </div>
          <v-slider
            v-model="orderDraft"
            color="primary"
            density="compact"
            hide-details
            :max="MAX_ORDER"
            :min="MIN_ORDER"
            show-ticks="always"
            :step="1"
            tick-size="3"
          />

          <v-divider class="my-3" />

          <v-switch v-model="store.animate" color="primary" density="compact" hide-details label="Animar operações" />
          <v-switch
            v-model="store.autoPlay"
            color="primary"
            density="compact"
            :disabled="!store.animate"
            hide-details
            label="Reproduzir automaticamente"
          />
          <div class="d-flex align-center ga-2 mt-1" :class="{ 'text-disabled': !store.animate }">
            <span class="text-body-2">Velocidade</span>
            <v-slider
              color="primary"
              density="compact"
              :disabled="!store.animate"
              hide-details
              :max="SPEEDS.length - 1"
              :min="0"
              :model-value="speedIndex"
              :step="1"
              @update:model-value="(i: number) => store.setSpeed(SPEEDS[i])"
            />
            <span class="text-body-2 speed-label">{{ store.speed }}×</span>
          </div>
          <v-switch v-model="store.autoFit" color="primary" density="compact" hide-details label="Câmera acompanha a árvore" />
        </v-expansion-panel-text>
      </v-expansion-panel>

      <!-- Benchmark -->
      <v-expansion-panel value="bench">
        <v-expansion-panel-title>
          <v-icon class="mr-3" icon="mdi-speedometer" size="small" />
          Benchmark
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div class="text-caption text-medium-emphasis mb-2">
            Mede a estrutura em uma árvore separada, sem desenhar.
          </div>
          <div class="d-flex ga-2">
            <v-select
              v-model="bench.count"
              class="flex-grow-1"
              density="compact"
              hide-details
              :item-title="(n: number) => n.toLocaleString('pt-BR')"
              :item-value="(n: number) => n"
              :items="[1_000, 10_000, 100_000, 500_000, 1_000_000]"
              label="Chaves"
              variant="outlined"
            />
            <v-select
              v-model="bench.order"
              class="order-select"
              density="compact"
              hide-details
              :items="ORDERS"
              label="Ordem"
              variant="outlined"
            />
          </div>
          <v-btn
            block
            class="mt-2"
            :loading="store.benchmarkRunning"
            prepend-icon="mdi-timer-outline"
            variant="tonal"
            @click="store.runBenchmark(bench.count, bench.order)"
          >
            Executar
          </v-btn>

          <v-table v-if="store.benchmarks.length > 0" class="mt-2 bench-table" density="compact">
            <thead>
              <tr>
                <th>n / ordem</th>
                <th class="text-end">Inserir</th>
                <th class="text-end">Buscar</th>
                <th class="text-end">Remover</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="b in store.benchmarks" :key="b.id">
                <td>
                  <v-icon
                    :color="b.valid ? 'success' : 'error'"
                    :icon="b.valid ? 'mdi-check-circle' : 'mdi-alert-circle'"
                    size="x-small"
                  />
                  {{ compact(b.count) }} / {{ b.order }}
                </td>
                <td class="text-end">{{ ms(b.insertMs) }}</td>
                <td class="text-end">{{ ms(b.searchMs) }}</td>
                <td class="text-end">{{ ms(b.deleteMs) }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <v-divider />

    <div class="pa-3">
      <v-btn
        block
        color="error"
        :disabled="store.stats.size === 0"
        prepend-icon="mdi-broom"
        variant="text"
        @click="confirmClear = true"
      >
        Limpar árvore
      </v-btn>
    </div>

    <v-dialog v-model="confirmClear" max-width="380">
      <v-card rounded="lg">
        <v-card-title class="pt-4">Limpar árvore?</v-card-title>
        <v-card-text>
          Todas as {{ store.stats.size.toLocaleString('pt-BR') }} chave(s) serão removidas.
          Você pode desfazer com <kbd>Ctrl</kbd>+<kbd>Z</kbd>.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmClear = false">Cancelar</v-btn>
          <v-btn color="error" variant="flat" @click="clearTree">Limpar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts" setup>
  import { computed, nextTick, reactive, ref, watch } from 'vue'
  import { MAX_ORDER, MIN_ORDER } from '@/lib/btree'
  import type { PanelSection } from './types'
  import { useBTreeStore } from '@/stores/btree'

  defineProps<{ rail: boolean }>()
  const emit = defineEmits<{ expand: [section: PanelSection] }>()
  const key = defineModel<string | number | null>('keyValue', { default: null })
  const open = defineModel<PanelSection | null>('section', { default: null })

  const store = useBTreeStore()

  const SECTIONS: Array<{ value: PanelSection, title: string, icon: string }> = [
    { value: 'operation', title: 'Operação', icon: 'mdi-plus-circle-outline' },
    { value: 'bulk', title: 'Inserção em lote', icon: 'mdi-layers-outline' },
    { value: 'settings', title: 'Ordem e animação', icon: 'mdi-tune-variant' },
    { value: 'bench', title: 'Benchmark', icon: 'mdi-speedometer' },
  ]
  const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 3, 4]
  const ORDERS = Array.from({ length: MAX_ORDER - MIN_ORDER + 1 }, (_, i) => i + MIN_ORDER)
  const PRESETS = [
    { label: '10 aleatórios', run: () => store.insertRandom(10, 1, 99) },
    { label: '1 a 15', run: () => store.insertSequence(1, 15, 1) },
    { label: 'clássico', run: () => store.insertText('50 20 80 10 30 60 90 25 35 70') },
  ]

  const keyField = ref<{ focus: () => void } | null>(null)
  const bulkMode = ref<'list' | 'random' | 'sequence'>('list')
  const listText = ref('')
  const random = reactive({ count: 15, min: 1, max: 99 })
  const seq = reactive({ from: 1, to: 20, step: 1 })
  const bench = reactive({ count: 100_000, order: 5 })
  const confirmClear = ref(false)
  const speedIndex = computed(() => {
    const i = SPEEDS.indexOf(store.speed)
    return i === -1 ? SPEEDS.indexOf(1) : i
  })

  // A ordem é aplicada com um pequeno atraso para não reconstruir a árvore a
  // cada movimento do controle deslizante.
  const orderDraft = ref(store.order)
  let orderTimer: ReturnType<typeof setTimeout> | undefined
  watch(() => store.order, value => {
    orderDraft.value = value
  })
  watch(orderDraft, value => {
    clearTimeout(orderTimer)
    orderTimer = setTimeout(() => store.setOrder(value), 300)
  })

  const num = (value: unknown, fallback: number) => {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }
  const ms = (v: number) => v < 10 ? `${v.toFixed(2)} ms` : `${Math.round(v).toLocaleString('pt-BR')} ms`
  const compact = (n: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(n)

  function focus () {
    nextTick(() => keyField.value?.focus())
  }

  function doInsert () {
    if (key.value === null || key.value === '') return focus()
    if (store.insert(key.value)) key.value = null
    focus()
  }

  function doSearch () {
    store.search(key.value)
    focus()
  }

  function doRemove () {
    if (store.remove(key.value)) key.value = null
    focus()
  }

  function doRandom () {
    store.insertRandom(num(random.count, 10), num(random.min, 1), num(random.max, 99))
  }

  function doInsertList () {
    store.insertText(listText.value)
    listText.value = ''
  }

  function clearTree () {
    store.clear()
    confirmClear.value = false
  }

  defineExpose({ focus })
</script>

<style scoped>
.label {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.panels :deep(.v-expansion-panel-title) {
  min-height: 48px;
  padding: 0 16px;
  font-size: 0.9rem;
  font-weight: 500;
}

.panels :deep(.v-expansion-panel-text__wrapper) {
  padding: 4px 16px 16px;
}

.fields-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.order-select {
  max-width: 96px;
}

.speed-label {
  min-width: 40px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.bench-table {
  font-variant-numeric: tabular-nums;
}

kbd {
  font-size: 0.8em;
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.25);
}
</style>
