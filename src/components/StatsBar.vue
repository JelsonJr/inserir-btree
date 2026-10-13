<template>
  <div class="stats-grid">
    <v-card
      v-for="item in items"
      :key="item.label"
      border
      class="stat"
      flat
      rounded="lg"
    >
      <div class="d-flex align-center ga-3 pa-3">
        <v-avatar :color="item.color" rounded="lg" size="36" variant="tonal">
          <v-icon :icon="item.icon" size="20" />
        </v-avatar>
        <div class="min-w-0">
          <div class="text-caption text-medium-emphasis text-truncate">{{ item.label }}</div>
          <div class="font-weight-bold text-truncate stat-value" :class="item.value.length > 11 ? 'text-body-2' : 'text-subtitle-1'" :title="item.value">{{ item.value }}</div>
        </div>
      </div>
    </v-card>
  </div>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { useBTreeStore } from '@/stores/btree'

  const store = useBTreeStore()
  const nf = new Intl.NumberFormat('pt-BR')
  const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
  const short = (n: number) => Math.abs(n) >= 10_000 ? compact.format(n) : String(Number(n.toFixed(2)))

  const items = computed(() => {
    const s = store.stats
    const valid = store.validationErrors.length === 0
    return [
      { label: 'Chaves', value: nf.format(s.size), icon: 'mdi-key-outline', color: 'primary' },
      { label: 'Nós', value: nf.format(s.nodes), icon: 'mdi-checkbox-blank-outline', color: 'secondary' },
      { label: 'Altura', value: nf.format(s.height), icon: 'mdi-arrow-expand-vertical', color: 'info' },
      { label: 'Ocupação', value: s.nodes ? `${Math.round(s.fill * 100)}%` : '—', icon: 'mdi-gauge', color: 'accent' },
      {
        label: 'Mín · Máx',
        value: s.min === null ? '—' : `${short(s.min)} · ${short(s.max!)}`,
        icon: 'mdi-arrow-left-right',
        color: 'warning',
      },
      {
        label: 'Invariantes',
        value: valid ? 'Válida' : `${store.validationErrors.length} erro(s)`,
        icon: valid ? 'mdi-shield-check-outline' : 'mdi-shield-alert-outline',
        color: valid ? 'success' : 'error',
      },
    ]
  })
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

@media (max-width: 599px) {
  .stats-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .stats-grid :deep(.v-avatar) {
    display: none;
  }
}

.min-w-0 {
  min-width: 0;
}

.stat-value {
  font-variant-numeric: tabular-nums;
}
</style>
