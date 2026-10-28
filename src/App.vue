<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
import { errorMessage } from './utils'
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
  <RouterView :key="$route.fullPath" />
</template>
