<template>
  <v-container>
    <v-row>
      <v-col class="text-center mt-5" cols="12">
        <h1>Trabalho final estrutura de dados</h1>
        <p>Feito por: <strong>Jelson</strong>, <strong>Lucas</strong>, <strong>Matheus</strong>, e <strong>Thais</strong></p>
      </v-col>
    </v-row>
    <v-row class="mt-10" justify="center">
      <v-col cols="8">
        <h2>Árvore BTree</h2>
        <v-text-field
          v-model="inputValue"
          dense
          label="Inserir valor"
          outlined
          type="number"
        />
        <div class="d-flex align-center justify-space-between">
          <v-btn color="primary" @click="addValue">Adicionar</v-btn>
          <v-btn color="error" @click="clearTree">Limpar</v-btn>
        </div>
        <div id="btree" class="text-center mt-10" />
      </v-col>
    </v-row>
  </v-container>
</template>
<script lang="ts">
  import { defineComponent, ref, watch } from 'vue'
  import * as d3 from 'd3'
  import { BTree } from './Btree'

  export default defineComponent({
    name: 'BTreeVisualizer',
    setup () {
      const btree = ref(new BTree())
      const inputValue = ref<number | null>(null)

      const renderTree = () => {
        const treeData = btree.value.toD3Format()
        const svg = d3.select('#btree').html('')

        const width = 800
        const height = 400

        const treeLayout = d3.tree().size([width - 100, height - 100])
        const hierarchy = d3.hierarchy(treeData)
        const tree = treeLayout(hierarchy)

        const svgCanvas = svg
          .append('svg')
          .attr('width', width)
          .attr('height', height)

        const g = svgCanvas.append('g').attr('transform', 'translate(50, 50)')

        g.selectAll('.link')
          .data(tree.links())
          .enter()
          .append('line')
          .attr('class', 'link')
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y)
          .style('stroke', '#ccc')
          .style('stroke-width', '2')

        g.selectAll('.node')
          .data(tree.descendants())
          .enter()
          .append('circle')
          .attr('class', 'node')
          .attr('cx', d => d.x)
          .attr('cy', d => d.y)
          .attr('r', 30)
          .style('fill', '#69b3a2')
          .style('stroke', '#006400')
          .style('stroke-width', '3')

        g.selectAll('.label')
          .data(tree.descendants())
          .enter()
          .append('text')
          .attr('x', d => d.x)
          .attr('y', d => d.y + 5)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .style('fill', '#fff')
          .style('font-size', '16px')
          .text(({ data }: any) => data.name)
      }

      const addValue = () => {
        if (inputValue.value !== null) {
          btree.value.insert(inputValue.value.toString())
          inputValue.value = null
          renderTree()
        }
      }

      const clearTree = () => {
        btree.value = new BTree()
        d3.select('#btree').html('')
      }

      watch(btree, renderTree)

      return {
        btree,
        inputValue,
        addValue,
        clearTree,
      }
    },
  })
</script>

<style scoped>
.node {
  fill: #69b3a2;
  stroke: #006400;
  stroke-width: 3px;
}

.link {
  fill: none;
  stroke: #404040;
  stroke-width: 2px;
}

text {
  font-size: 16px;
  fill: #fff;
  text-anchor: middle;
}
</style>
