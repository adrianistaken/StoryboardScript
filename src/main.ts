import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import { initializeAuth } from './services/auth'
import HomeView from './views/HomeView.vue'
import WorkspaceView from './views/WorkspaceView.vue'
import PrivacyView from './views/PrivacyView.vue'
import '@fontsource/source-sans-3/400.css'
import '@fontsource/source-sans-3/500.css'
import '@fontsource/source-sans-3/600.css'
import './style.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/privacy', component: PrivacyView },
    { path: '/project/:id', component: WorkspaceView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
void initializeAuth()
createApp(App).use(router).mount('#app')
