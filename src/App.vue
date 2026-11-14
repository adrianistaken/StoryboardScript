<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
import { useRoute } from 'vue-router'
import { errorMessage } from './utils'
import { authReady, authError } from './services/auth'
import { accountsEnabled } from './services/auth'
import { HardDrive } from '@lucide/vue'
import Brand from './components/Brand.vue'
import AccountMenu from './components/AccountMenu.vue'
const error = ref('')
const route = useRoute()
const isLibraryRoute = () => route.path === '/' || route.path === '/projects'
const showLibraryHeader = ref(isLibraryRoute())
function afterPageLeaves() {
  showLibraryHeader.value = isLibraryRoute()
}
onErrorCaptured((e) => {
  error.value = errorMessage(e)
  return false
})
</script>
<template>
  <a class="skip-link" href="#main">Skip to content</a>
  <div v-if="error" class="global-error" role="alert">
    {{ error }} <button @click="error = ''">Dismiss</button>
  </div>
  <div v-if="authError" class="error-banner" role="alert">
    {{ authError }}<button class="text-button" @click="authError = ''">Dismiss</button>
  </div>
  <header v-if="authReady && showLibraryHeader" class="home-header">
    <div class="home-header-left">
      <Brand />
      <nav class="home-nav" aria-label="Main navigation">
        <RouterLink to="/projects">Projects</RouterLink>
      </nav>
    </div>
    <AccountMenu /><span v-if="!accountsEnabled" class="local-label"><HardDrive :size="15" /> Saved in this browser</span>
  </header>
  <RouterView v-if="authReady || route.path === '/privacy'" v-slot="{ Component }">
    <Transition name="page" mode="out-in" @after-leave="afterPageLeaves">
      <component :is="Component" :key="route.fullPath" />
    </Transition>
  </RouterView>
  <div v-else class="loading-page" role="status">Restoring your account…</div>
</template>
