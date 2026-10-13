/**
 * main.ts
 *
 * Registra Vuetify e Pinia e monta a aplicação.
 */

import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import vuetify from './plugins/vuetify'

createApp(App)
  .use(vuetify)
  .use(createPinia())
  .mount('#app')
