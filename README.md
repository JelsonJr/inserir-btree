# Árvore B — Visualizador interativo

Trabalho final de **Estrutura de Dados** — feito por **Jelson**, **Lucas**, **Matheus** e **Thais**.

Aplicação web (Vue 3 + Vuetify 3 + D3) para estudar Árvores B: insira, busque e remova
chaves e acompanhe cada passo do algoritmo — divisões, promoções da mediana, empréstimos
e fusões — com animação.

## Funcionalidades

**Estrutura de dados** (`src/lib/btree.ts`)

- Árvore B de **ordem configurável (3 a 10)**; a ordem 3 corresponde à árvore 2-3.
- **Inserção** com divisão de nós e crescimento pela raiz.
- **Remoção** completa (predecessora, empréstimo do irmão esquerdo/direito, fusão e
  redução da altura).
- **Busca** com caminho percorrido, consulta por **intervalo**, mínimo e máximo.
- Percursos **em ordem**, **pré-ordem** e **por nível**.
- **Validação** de todas as invariantes (ordenação, limites de chaves, número de filhos,
  folhas no mesmo nível).
- Busca binária dentro dos nós, inserção iterativa e nenhuma reatividade do Vue na
  estrutura: 100 mil chaves são inseridas, buscadas e removidas em menos de 1 segundo.
- Serialização (snapshot) com validação ao importar.

**Interface**

- Animação **passo a passo** de cada operação, com reprodução, pausa, avanço/retrocesso
  e controle de velocidade.
- Desenho com nós em formato de "caixas de chaves", arestas saindo entre as chaves,
  transições suaves, zoom/arraste e enquadramento automático.
- **Inserção em lote**: listas, chaves aleatórias (com intervalo) e sequências.
- **Desfazer/refazer** (Ctrl+Z / Ctrl+Y), troca de ordem reconstruindo a árvore.
- Estatísticas ao vivo: chaves, nós, altura, ocupação, mín/máx e validade.
- Abas de **Registro**, **Percursos**, **Intervalo**, **Validação** e **Teoria**.
- **Benchmark** de inserção/busca/remoção com até 1 milhão de chaves.
- Exportação em **PNG**, **SVG** e **JSON**; importação de JSON.
- Tema claro/escuro, layout responsivo e estado salvo automaticamente no navegador.
- Árvores grandes são desenhadas em "modo leve" (sem transições e com menos elementos);
  acima de 2.500 nós o desenho só é feito sob demanda.

## Como executar

Requer Node.js 18+ (recomendado 22).

```bash
npm install
npm run dev        # servidor de desenvolvimento em http://localhost:3000
```

| Comando              | Descrição                                    |
|----------------------|----------------------------------------------|
| `npm run dev`        | Servidor de desenvolvimento com recarga      |
| `npm run build`      | Checagem de tipos + build de produção        |
| `npm run preview`    | Serve o build de produção                    |
| `npm test`           | Testes unitários (Vitest)                    |
| `npm run lint`       | ESLint                                       |
| `npm run typecheck`  | Checagem de tipos (vue-tsc)                  |
| `npm run check`      | Lint + tipos + testes                        |

## Atalhos

| Tecla                 | Ação                                  |
|-----------------------|---------------------------------------|
| `Enter`               | Inserir o valor digitado              |
| `Shift` + `Enter`     | Buscar o valor digitado               |
| `Ctrl` + `Z` / `Y`    | Desfazer / refazer                    |
| `Espaço`              | Reproduzir / pausar a animação        |
| `←` / `→`             | Passo anterior / próximo              |
| `F`                   | Enquadrar a árvore                    |

## Estrutura do projeto

```
src/
├── lib/
│   ├── btree.ts           # Árvore B (inserção, remoção, busca, validação…)
│   ├── btree.spec.ts      # Testes, incluindo testes aleatórios para cada ordem
│   └── parse.ts           # Conversão de texto em chaves, sorteios e sequências
├── stores/
│   └── btree.ts           # Estado (Pinia): histórico, animação, log, persistência
├── components/
│   ├── TreeCanvas.vue     # Desenho D3 com zoom, destaques e exportação
│   ├── ControlPanel.vue   # Operações, lote, configurações e benchmark
│   ├── PlaybackBar.vue    # Controles da animação passo a passo
│   ├── StatsBar.vue       # Estatísticas da árvore
│   └── InfoTabs.vue       # Registro, percursos, intervalo, validação e teoria
├── pages/index.vue        # Página principal
└── plugins/vuetify.ts     # Temas claro e escuro
```

## Formato JSON de importação

São aceitos três formatos:

```jsonc
[50, 20, 80]                                  // lista de chaves (ordem atual)
{ "order": 4, "keys": [50, 20, 80] }          // ordem + chaves
{ "order": 3, "nextId": 4, "root": { … } }    // estrutura exportada pelo app
```
