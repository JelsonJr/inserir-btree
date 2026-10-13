<template>
  <div class="stats d-flex flex-wrap align-center">
    <div v-for="item in items" :key="item.label" class="stat" :title="item.title ?? item.label">
      <span class="value">{{ item.value }}</span>
      <span class="name">{{ item.label }}</span>
    </div>
    <v-chip
      class="ml-1"
      :color="valid ? 'success' : 'error'"
      :prepend-icon="valid ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline'"
      size="small"
      :title="valid ? 'Todas as invariantes da Árvore B são satisfeitas' : store.validationErrors[0]"
      variant="tonal"
    >
      {{ valid ? 'válida' : `${store.validationErrors.length} erro(s)` }}
    </v-chip>
  </div>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { useBTreeStore } from '@/stores/btree'

  const store = useBTreeStore()
  const nf = new Intl.NumberFormat('pt-BR')
  const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
  const short = (n: number) => Math.abs(n) >= 10_000 ? compact.format(n) : String(Number(n.toFixed(2)))

  const valid = computed(() => store.validationErrors.length === 0)

  const items = computed(() => {
    const s = store.stats
    const list: Array<{ label: string, value: string, title?: string }> = [
      { label: 'chaves', value: nf.format(s.size) },
      { label: 'nós', value: nf.format(s.nodes) },
      { label: 'altura', value: nf.format(s.height) },
      { label: 'ocupação', value: s.nodes ? `${Math.round(s.fill * 100)}%` : '—', title: 'Ocupação média dos nós' },
    ]
    if (s.min !== null) list.push({ label: 'intervalo', value: `${short(s.min)} – ${short(s.max!)}`, title: 'Menor e maior chave' })
    return list
  })
</script>

<style scoped>
.stats {
  gap: 4px 20px;
}

.stat {
  display: flex;
  align-items: baseline;
  gap: 6px;
  white-space: nowrap;
}

.value {
  font-weight: 700;
  font-size: 0.95rem;
  font-variant-numeric: tabular-nums;
}

.name {
  font-size: 0.8rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
