<template>
  <v-card border flat rounded="lg">
    <v-tabs v-model="tab" color="primary" density="comfortable" show-arrows>
      <v-tab prepend-icon="mdi-history" value="log">Registro</v-tab>
      <v-tab prepend-icon="mdi-transit-connection-variant" value="traversal">Percursos</v-tab>
      <v-tab prepend-icon="mdi-arrow-expand-horizontal" value="range">Intervalo</v-tab>
      <v-tab prepend-icon="mdi-shield-check-outline" value="validation">Validação</v-tab>
      <v-tab prepend-icon="mdi-school-outline" value="theory">Teoria</v-tab>
    </v-tabs>
    <v-divider />

    <v-window v-model="tab" class="tab-body">
      <!-- Registro -->
      <v-window-item value="log">
        <div v-if="store.log.length === 0" class="empty">Nenhuma operação ainda.</div>
        <template v-else>
          <div class="d-flex justify-end px-3 pt-2">
            <v-btn prepend-icon="mdi-delete-sweep-outline" size="small" variant="text" @click="store.clearLog()">
              Limpar registro
            </v-btn>
          </div>
          <v-virtual-scroll :height="220" item-key="id" :items="store.log">
            <template #default="{ item }">
              <div class="log-row d-flex align-start ga-3 px-4 py-2">
                <v-icon :color="LEVEL[item.level].color" :icon="LEVEL[item.level].icon" size="18" />
                <span class="text-body-2 flex-grow-1">{{ item.text }}</span>
                <span class="text-caption text-medium-emphasis">{{ time(item.time) }}</span>
              </div>
            </template>
          </v-virtual-scroll>
        </template>
      </v-window-item>

      <!-- Percursos -->
      <v-window-item value="traversal">
        <div v-if="store.stats.size === 0" class="empty">A árvore está vazia.</div>
        <div v-else class="pa-4 d-flex flex-column ga-4">
          <section>
            <div class="section-title">
              Em ordem (crescente)
              <v-btn
                aria-label="Copiar"
                density="comfortable"
                icon="mdi-content-copy"
                size="x-small"
                variant="text"
                @click="copy(store.inOrder.join(', '))"
              />
            </div>
            <div class="mono seq">{{ preview(store.inOrder) }}</div>
          </section>
          <section>
            <div class="section-title">Por nível (largura)</div>
            <div v-for="(level, i) in visibleLevels" :key="i" class="d-flex align-start ga-3 mb-1">
              <v-chip class="flex-shrink-0" label size="x-small" variant="tonal">N{{ i }}</v-chip>
              <div class="mono seq">{{ previewNodes(level) }}</div>
            </div>
          </section>
          <section>
            <div class="section-title">Pré-ordem (nós)</div>
            <div class="mono seq">{{ previewNodes(store.preOrder) }}</div>
          </section>
        </div>
      </v-window-item>

      <!-- Intervalo -->
      <v-window-item value="range">
        <div class="pa-4">
          <div class="d-flex flex-wrap align-center ga-3">
            <v-text-field
              v-model.number="lo"
              class="range-field"
              density="compact"
              hide-details
              label="De"
              type="number"
              variant="outlined"
            />
            <v-text-field
              v-model.number="hi"
              class="range-field"
              density="compact"
              hide-details
              label="Até"
              type="number"
              variant="outlined"
            />
            <span class="text-body-2 text-medium-emphasis">
              {{ rangeResult.length.toLocaleString('pt-BR') }} chave(s) no intervalo
            </span>
          </div>
          <div class="mono seq mt-3">{{ rangeResult.length ? preview(rangeResult) : '—' }}</div>
        </div>
      </v-window-item>

      <!-- Validação -->
      <v-window-item value="validation">
        <div class="pa-4">
          <v-alert
            v-if="store.validationErrors.length === 0"
            density="compact"
            icon="mdi-shield-check"
            type="success"
            variant="tonal"
          >
            Todas as invariantes da Árvore B são satisfeitas.
          </v-alert>
          <v-alert v-else density="compact" type="error" variant="tonal">
            <div v-for="(e, i) in store.validationErrors.slice(0, 20)" :key="i">{{ e }}</div>
          </v-alert>
          <v-list class="mt-2" density="compact">
            <v-list-item v-for="rule in rules" :key="rule" prepend-icon="mdi-check" :title="rule" />
          </v-list>
        </div>
      </v-window-item>

      <!-- Teoria -->
      <v-window-item value="theory">
        <div class="pa-4 text-body-2 theory">
          <p>
            Uma <strong>Árvore B de ordem {{ m }}</strong> é uma árvore de busca balanceada em que cada nó
            guarda até <strong>{{ m - 1 }}</strong> chaves ordenadas e tem até <strong>{{ m }}</strong> filhos.
            Todas as folhas ficam na mesma profundidade, garantindo operações em
            <strong>O(log n)</strong>.
          </p>
          <p>
            <strong>Inserção:</strong> desce-se até a folha correta e a chave é inserida em ordem. Se o nó
            ultrapassar {{ m - 1 }} chaves, ele é <em>dividido</em>: a chave mediana sobe para o pai e as
            demais formam dois nós. Se a raiz for dividida, a altura da árvore aumenta.
          </p>
          <p>
            <strong>Remoção:</strong> chaves em nós internos são trocadas pela predecessora. Se um nó ficar com
            menos de {{ minKeys }} chave(s), ele <em>pega emprestado</em> de um irmão ou é <em>fundido</em> com ele,
            trazendo a chave separadora do pai. Se a raiz esvaziar, a altura diminui.
          </p>
          <p class="mb-0">
            Com {{ store.stats.size.toLocaleString('pt-BR') }} chave(s), a altura máxima teórica é
            <strong>{{ maxHeight }}</strong> e a atual é <strong>{{ store.stats.height }}</strong>.
          </p>
        </div>
      </v-window-item>
    </v-window>
  </v-card>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import { type LogLevel, useBTreeStore } from '@/stores/btree'

  const store = useBTreeStore()
  const tab = ref('log')
  const lo = ref<number | string>(0)
  const hi = ref<number | string>(50)

  const PREVIEW_LIMIT = 400
  const LEVEL: Record<LogLevel, { icon: string, color: string }> = {
    success: { icon: 'mdi-check-circle-outline', color: 'success' },
    info: { icon: 'mdi-information-outline', color: 'info' },
    warning: { icon: 'mdi-alert-outline', color: 'warning' },
    error: { icon: 'mdi-alert-circle-outline', color: 'error' },
  }

  const m = computed(() => store.order)
  const minKeys = computed(() => Math.ceil(m.value / 2) - 1)
  const maxHeight = computed(() => {
    const n = store.stats.size
    if (n === 0) return 0
    // h ≤ 1 + log_t((n + 1) / 2), com t = ⌈m/2⌉
    const t = Math.ceil(m.value / 2)
    return Math.floor(1 + Math.log((n + 1) / 2) / Math.log(t))
  })

  const rules = computed(() => [
    `Cada nó tem no máximo ${m.value - 1} chave(s) e ${m.value} filho(s)`,
    `Nós que não são raiz têm ao menos ${minKeys.value} chave(s)`,
    'Chaves de cada nó estão em ordem estritamente crescente',
    'Um nó interno com k chaves tem exatamente k + 1 filhos',
    'Todas as folhas estão na mesma profundidade',
  ])

  const visibleLevels = computed(() => store.levelOrder.slice(0, 12))

  const rangeResult = computed(() => {
    void store.version
    const a = Number(lo.value)
    const b = Number(hi.value)
    if (!Number.isFinite(a) || !Number.isFinite(b)) return []
    return store.rangeQuery(Math.min(a, b), Math.max(a, b))
  })

  function preview (keys: number[]) {
    const head = keys.slice(0, PREVIEW_LIMIT).join(', ')
    return keys.length > PREVIEW_LIMIT ? `${head}, … (+${(keys.length - PREVIEW_LIMIT).toLocaleString('pt-BR')})` : head
  }

  function previewNodes (nodes: number[][]) {
    const head = nodes.slice(0, PREVIEW_LIMIT / 4).map(n => `[${n.join(', ')}]`).join(' ')
    return nodes.length > PREVIEW_LIMIT / 4 ? `${head} … (+${(nodes.length - PREVIEW_LIMIT / 4).toLocaleString('pt-BR')})` : head
  }

  const time = (t: number) => new Date(t).toLocaleTimeString('pt-BR')

  async function copy (text: string) {
    try {
      await navigator.clipboard.writeText(text)
      store.addLog('info', 'Percurso copiado para a área de transferência.')
    } catch {
      store.addLog('warning', 'Não foi possível copiar.')
    }
  }
</script>

<style scoped>
.tab-body {
  min-height: 240px;
}

.empty {
  padding: 48px 16px;
  text-align: center;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.log-row + .log-row {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.section-title {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  margin-bottom: 6px;
}

.mono {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85rem;
}

.seq {
  word-break: break-word;
  max-height: 140px;
  overflow-y: auto;
}

.range-field {
  max-width: 140px;
}

.theory p {
  margin-bottom: 12px;
  line-height: 1.6;
}
</style>
