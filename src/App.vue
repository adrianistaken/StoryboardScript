<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
import { errorMessage } from './utils'
import { authReady, authError } from './services/auth'
const error = ref('')
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
  <RouterView v-if="authReady" :key="$route.fullPath" />
  <div v-else class="loading-page" role="status">Restoring your account…</div>
</template>
