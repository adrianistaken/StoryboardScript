import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import HomeView from './views/HomeView.vue'
import WorkspaceView from './views/WorkspaceView.vue'
import '@fontsource/source-sans-3/400.css'
import '@fontsource/source-sans-3/500.css'
import '@fontsource/source-sans-3/600.css'
import './style.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/project/:id', component: WorkspaceView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
createApp(App).use(router).mount('#app')
