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

- Painel lateral **recolhível** (atalho `[`), organizado em seções: operação
  sempre visível; inserção em lote, ordem/animação e benchmark em acordeão.
  No modo recolhido, os ícones abrem o painel direto na seção escolhida.
- Animação **passo a passo** com controle flutuante: reproduzir/pausar,
  passo anterior/próximo, **linha do tempo arrastável**, velocidade de 0,25× a 4×
  e modo de reprodução automática ou manual.
- Animações fluidas (60 fps): nós criados por divisão surgem do nó original,
  nós fundidos deslizam até o vizinho, chaves deslizam dentro do nó para abrir
  espaço, o caminho percorrido fica destacado e o nó ativo pulsa. A duração das
  transições acompanha a velocidade escolhida e respeita a preferência do
  sistema por movimento reduzido.
- Câmera que só se move quando necessário: reenquadra quando a árvore muda de
  forma e desliza para manter o nó em destaque visível.
- **Inserção em lote**: listas, chaves aleatórias (com intervalo) e sequências.
- **Desfazer/refazer** (Ctrl+Z / Ctrl+Y), troca de ordem reconstruindo a árvore.
- Estatísticas compactas: chaves, nós, altura, ocupação, intervalo e validade.
- Abas de **Registro**, **Percursos**, **Intervalo**, **Validação** e **Teoria**.
- **Benchmark** de inserção/busca/remoção com até 1 milhão de chaves.
- Exportação em **PNG**, **SVG** e **JSON**; importação de JSON.
- Tema claro/escuro, layout responsivo e estado salvo automaticamente no navegador.
- Árvores grandes são desenhadas em "modo leve" (sem transições e com menos elementos);
  acima de 2.500 nós o desenho só é feito sob demanda.

## Como executar

Requer **Node.js 24.21.0** ou superior (versão definida em `.nvmrc`).

```bash
nvm use            # opcional: usa a versão do .nvmrc
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
| `npm run typecheck`  | Checagem de tipos (vue-tsc + configs)        |
| `npm run check`      | Lint + tipos + testes                        |

## Atalhos

| Tecla                 | Ação                                  |
|-----------------------|---------------------------------------|
| `Enter`               | Inserir o valor digitado              |
| `Shift` + `Enter`     | Buscar o valor digitado               |
| `Ctrl` + `Z` / `Y`    | Desfazer / refazer                    |
| `Espaço`              | Reproduzir / pausar a animação        |
| `←` / `→`             | Passo anterior / próximo              |
| `Home` / `End`        | Primeiro passo / resultado final      |
| `F`                   | Enquadrar a árvore                    |
| `[`                   | Recolher / expandir o painel          |
| `Esc`                 | Sair do campo de valor                |

## Tecnologias

Vue 3.5, Vuetify 4, Pinia 4, D3 7, Vite 8, TypeScript 6, Vitest 5 e ESLint 10
(configuração flat). As fontes (Roboto) são servidas localmente via
`@fontsource/roboto`, sem depender do Google Fonts.

## Estrutura do projeto

```
src/
├── App.vue                # Layout: barra superior, painel lateral e área da árvore
├── main.ts                # Inicialização (Vuetify, Pinia, fontes)
├── lib/
│   ├── btree.ts           # Árvore B (inserção, remoção, busca, validação…)
│   ├── btree.spec.ts      # Testes, incluindo testes aleatórios para cada ordem
│   └── parse.ts           # Conversão de texto em chaves, sorteios e sequências
├── stores/
│   └── btree.ts           # Estado (Pinia): histórico, animação, log, persistência
├── components/
│   ├── TreeCanvas.vue     # Desenho D3 com animações, câmera, zoom e exportação
│   ├── ControlPanel.vue   # Painel lateral (operação, lote, ordem/animação, benchmark)
│   ├── PlaybackBar.vue    # Controle flutuante da animação passo a passo
│   ├── StatsBar.vue       # Estatísticas da árvore
│   └── InfoTabs.vue       # Registro, percursos, intervalo, validação e teoria
└── plugins/vuetify.ts     # Temas claro e escuro
```

## Formato JSON de importação

São aceitos três formatos:

```jsonc
[50, 20, 80]                                  // lista de chaves (ordem atual)
{ "order": 4, "keys": [50, 20, 80] }          // ordem + chaves
{ "order": 3, "nextId": 4, "root": { … } }    // estrutura exportada pelo app
```
