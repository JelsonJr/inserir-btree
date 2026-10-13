<template>
  <div class="pa-4 d-flex flex-column ga-4">
    <!-- Operação individual -->
    <v-card border flat rounded="lg">
      <v-card-item>
        <template #prepend>
          <v-avatar color="primary" size="32" variant="tonal">
            <v-icon icon="mdi-numeric" size="18" />
          </v-avatar>
        </template>
        <v-card-title class="text-subtitle-1 font-weight-bold">Operação</v-card-title>
        <v-card-subtitle>Inserir, buscar ou remover uma chave</v-card-subtitle>
      </v-card-item>
      <v-card-text>
        <v-text-field
          ref="keyField"
          v-model="key"
          autofocus
          clearable
          density="comfortable"
          hide-details="auto"
          hint="Enter insere · Shift+Enter busca"
          label="Valor"
          persistent-hint
          prepend-inner-icon="mdi-pound"
          type="number"
          variant="outlined"
          @keydown.enter.exact.prevent="doInsert"
          @keydown.enter.shift.prevent="doSearch"
        />
        <div class="d-flex ga-2 mt-4">
          <v-btn
            class="flex-grow-1"
            color="primary"
            prepend-icon="mdi-plus-circle-outline"
            variant="flat"
            @click="doInsert"
          >Inserir</v-btn>
          <v-btn
            aria-label="Buscar"
            color="info"
            icon="mdi-magnify"
            rounded="lg"
            size="default"
            variant="tonal"
            @click="doSearch"
          />
          <v-btn
            aria-label="Remover"
            color="error"
            icon="mdi-delete-outline"
            rounded="lg"
            size="default"
            variant="tonal"
            @click="doRemove"
          />
        </div>
        <div class="d-flex flex-wrap ga-2 mt-4">
          <v-chip
            v-for="preset in presets"
            :key="preset.label"
            label
            :prepend-icon="preset.icon"
            size="small"
            variant="tonal"
            @click="preset.run"
          >{{ preset.label }}</v-chip>
        </div>
      </v-card-text>
    </v-card>

    <!-- Lote -->
    <v-card border flat rounded="lg">
      <v-card-item>
        <template #prepend>
          <v-avatar color="secondary" size="32" variant="tonal">
            <v-icon icon="mdi-layers-triple-outline" size="18" />
          </v-avatar>
        </template>
        <v-card-title class="text-subtitle-1 font-weight-bold">Em lote</v-card-title>
        <v-card-subtitle>Popular a árvore rapidamente</v-card-subtitle>
      </v-card-item>
      <v-tabs v-model="bulkTab" color="secondary" density="compact" grow>
        <v-tab value="list">Lista</v-tab>
        <v-tab value="random">Aleatório</v-tab>
        <v-tab value="sequence">Sequência</v-tab>
      </v-tabs>
      <v-card-text>
        <v-window v-model="bulkTab">
          <v-window-item value="list">
            <v-textarea
              v-model="listText"
              auto-grow
              density="comfortable"
              hide-details
              label="Valores"
              placeholder="Ex.: 50, 20, 80, 10, 30"
              rows="2"
              variant="outlined"
            />
            <v-btn
              block
              class="mt-3"
              color="secondary"
              :disabled="!listText.trim()"
              prepend-icon="mdi-playlist-plus"
              variant="tonal"
              @click="doInsertList"
            >Inserir lista</v-btn>
          </v-window-item>

          <v-window-item value="random">
            <v-row dense>
              <v-col cols="12">
                <v-text-field
                  v-model.number="random.count"
                  density="comfortable"
                  hide-details
                  label="Quantidade"
                  min="1"
                  type="number"
                  variant="outlined"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="random.min"
                  density="comfortable"
                  hide-details
                  label="Mínimo"
                  type="number"
                  variant="outlined"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="random.max"
                  density="comfortable"
                  hide-details
                  label="Máximo"
                  type="number"
                  variant="outlined"
                />
              </v-col>
            </v-row>
            <div class="d-flex ga-2 mt-3">
              <v-btn
                class="flex-grow-1"
                color="secondary"
                prepend-icon="mdi-dice-multiple-outline"
                variant="tonal"
                @click="doRandom"
              >
                Inserir
              </v-btn>
              <v-btn
                class="flex-grow-1"
                color="error"
                prepend-icon="mdi-shuffle-variant"
                variant="tonal"
                @click="store.removeRandom(num(random.count, 1))"
              >
                Remover
              </v-btn>
            </div>
          </v-window-item>

          <v-window-item value="sequence">
            <v-row dense>
              <v-col cols="4">
                <v-text-field
                  v-model.number="seq.from"
                  density="comfortable"
                  hide-details
                  label="De"
                  type="number"
                  variant="outlined"
                />
              </v-col>
              <v-col cols="4">
                <v-text-field
                  v-model.number="seq.to"
                  density="comfortable"
                  hide-details
                  label="Até"
                  type="number"
                  variant="outlined"
                />
              </v-col>
              <v-col cols="4">
                <v-text-field
                  v-model.number="seq.step"
                  density="comfortable"
                  hide-details
                  label="Passo"
                  min="1"
                  type="number"
                  variant="outlined"
                />
              </v-col>
            </v-row>
            <v-btn
              block
              class="mt-3"
              color="secondary"
              prepend-icon="mdi-sort-numeric-ascending"
              variant="tonal"
              @click="store.insertSequence(num(seq.from, 1), num(seq.to, 20), num(seq.step, 1))"
            >Inserir sequência</v-btn>
          </v-window-item>
        </v-window>
      </v-card-text>
    </v-card>

    <!-- Configurações -->
    <v-card border flat rounded="lg">
      <v-card-item>
        <template #prepend>
          <v-avatar color="accent" size="32" variant="tonal">
            <v-icon icon="mdi-tune-variant" size="18" />
          </v-avatar>
        </template>
        <v-card-title class="text-subtitle-1 font-weight-bold">Configurações</v-card-title>
        <v-card-subtitle>
          Ordem {{ store.order }} · {{ store.order - 1 }} chave(s) máx. · {{ Math.ceil(store.order / 2) - 1 }} mín.
        </v-card-subtitle>
      </v-card-item>
      <v-card-text>
        <div class="text-caption text-medium-emphasis mb-1">Ordem da árvore (máximo de filhos por nó)</div>
        <v-slider
          v-model="orderDraft"
          color="primary"
          hide-details
          :max="MAX_ORDER"
          :min="MIN_ORDER"
          show-ticks="always"
          step="1"
          thumb-label
          tick-size="3"
        />
        <v-switch
          v-model="store.animate"
          class="mt-2"
          color="primary"
          density="compact"
          hide-details
          inset
          label="Animar passo a passo"
        />
        <div class="d-flex align-center ga-3" :class="{ 'text-disabled': !store.animate }">
          <v-icon icon="mdi-speedometer-slow" size="small" />
          <v-slider
            v-model="store.speed"
            color="primary"
            density="compact"
            :disabled="!store.animate"
            hide-details
            max="4"
            min="0.25"
            step="0.25"
          />
          <v-icon icon="mdi-speedometer" size="small" />
          <span class="text-caption speed-label">{{ store.speed }}×</span>
        </div>
        <v-switch
          v-model="store.autoFit"
          color="primary"
          density="compact"
          hide-details
          inset
          label="Enquadrar automaticamente"
        />
      </v-card-text>
    </v-card>

    <!-- Desempenho -->
    <v-card border flat rounded="lg">
      <v-card-item>
        <template #prepend>
          <v-avatar color="success" size="32" variant="tonal">
            <v-icon icon="mdi-rocket-launch-outline" size="18" />
          </v-avatar>
        </template>
        <v-card-title class="text-subtitle-1 font-weight-bold">Benchmark</v-card-title>
        <v-card-subtitle>Mede a estrutura sem desenhar</v-card-subtitle>
      </v-card-item>
      <v-card-text>
        <v-row dense>
          <v-col cols="7">
            <v-select
              v-model="bench.count"
              density="comfortable"
              hide-details
              :item-title="(n: number) => n.toLocaleString('pt-BR')"
              :item-value="(n: number) => n"
              :items="[1_000, 10_000, 100_000, 500_000, 1_000_000]"
              label="Chaves"
              variant="outlined"
            />
          </v-col>
          <v-col cols="5">
            <v-select
              v-model="bench.order"
              density="comfortable"
              hide-details
              :items="orders"
              label="Ordem"
              variant="outlined"
            />
          </v-col>
        </v-row>
        <v-btn
          block
          class="mt-3"
          color="success"
          :loading="store.benchmarkRunning"
          prepend-icon="mdi-timer-outline"
          variant="tonal"
          @click="store.runBenchmark(bench.count, bench.order)"
        >Executar</v-btn>

        <v-table v-if="store.benchmarks.length" class="mt-3 bench-table" density="compact">
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
      </v-card-text>
    </v-card>

    <v-btn
      color="error"
      :disabled="store.stats.size === 0"
      prepend-icon="mdi-broom"
      variant="outlined"
      @click="confirmClear = true"
    >Limpar árvore</v-btn>

    <v-dialog v-model="confirmClear" max-width="380">
      <v-card rounded="lg">
        <v-card-title class="d-flex align-center ga-2">
          <v-icon color="error" icon="mdi-broom" /> Limpar árvore?
        </v-card-title>
        <v-card-text>
          Todas as {{ store.stats.size.toLocaleString('pt-BR') }} chave(s) serão removidas.
          Você pode desfazer com <kbd>Ctrl</kbd>+<kbd>Z</kbd>.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmClear = false">Cancelar</v-btn>
          <v-btn color="error" variant="flat" @click="store.clear(); confirmClear = false">Limpar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts" setup>
  import { reactive, ref, watch } from 'vue'
  import { MAX_ORDER, MIN_ORDER } from '@/lib/btree'
  import { useBTreeStore } from '@/stores/btree'

  const key = defineModel<string | number | null>('keyValue', { default: null })

  const store = useBTreeStore()

  const keyField = ref<{ focus:() => void } | null>(null)
  const bulkTab = ref('list')
  const listText = ref('')
  const random = reactive({ count: 15, min: 1, max: 99 })
  const seq = reactive({ from: 1, to: 20, step: 1 })
  const bench = reactive({ count: 100_000, order: 5 })
  const confirmClear = ref(false)

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
  const orders = Array.from({ length: MAX_ORDER - MIN_ORDER + 1 }, (_, i) => i + MIN_ORDER)

  const num = (value: unknown, fallback: number) => {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }
  const ms = (v: number) => v < 10 ? `${v.toFixed(2)} ms` : `${Math.round(v).toLocaleString('pt-BR')} ms`
  const compact = (n: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(n)

  const presets = [
    { label: '+10 aleatórios', icon: 'mdi-dice-5-outline', run: () => store.insertRandom(10, 1, 99) },
    { label: '1 … 15', icon: 'mdi-sort-numeric-ascending', run: () => store.insertSequence(1, 15, 1) },
    { label: 'Exemplo', icon: 'mdi-lightbulb-on-outline', run: () => store.insertText('50 20 80 10 30 60 90 25 35 70') },
  ]

  function focus () {
    keyField.value?.focus()
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

  defineExpose({ focus })
</script>

<style scoped>
.speed-label {
  min-width: 36px;
  text-align: right;
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
