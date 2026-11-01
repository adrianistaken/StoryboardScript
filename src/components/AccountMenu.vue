<script setup lang="ts">
import { ref, watch } from 'vue'
import { Cloud, LogOut } from '@lucide/vue'
import Modal from './Modal.vue'
import { accountsEnabled, accountUser, googleSignInAvailable, sendSignIn, signInWithGoogle, signOut } from '../services/auth'
import { errorMessage } from '../utils'
const open = ref(false),
  email = ref(''),
  busy = ref(false),
  error = ref(''),
  sent = ref(false),
  googleAvailable = ref(false)
watch(open, async (isOpen) => {
  if (isOpen) googleAvailable.value = await googleSignInAvailable()
  else googleAvailable.value = false
})
watch(accountUser, (value) => {
  if (value) {
    open.value = false
    sent.value = false
  }
})
async function submit() {
  busy.value = true
  error.value = ''
  try {
    await sendSignIn(email.value.trim())
    sent.value = true
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
async function continueWithGoogle() {
  busy.value = true
  error.value = ''
  try {
    await signInWithGoogle()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
async function leave() {
  busy.value = true
  error.value = ''
  try {
    await signOut()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <div v-if="accountsEnabled" class="account-menu">
    <template v-if="accountUser">
      <span class="account-email">{{ accountUser.email }}</span>
      <button class="text-button" :disabled="busy" @click="leave">
        <LogOut :size="15" /> Sign out
      </button>
    </template>
    <button v-else class="button secondary" @click="open = true">
      <Cloud :size="16" /> Sign in
    </button>
    <span v-if="error && !open" role="alert">{{ error }}</span>
    <Modal :open="open" title="Your scripts, on any device" @close="open = false">
      <p>
        Sign in to access your scripts on any device. Your account includes your
        writing, reference images, and reading pace.
      </p>
      <button
        v-if="googleAvailable"
        class="button secondary google-sign-in"
        type="button"
        :disabled="busy"
        @click="continueWithGoogle">
        <span class="google-mark" aria-hidden="true">G</span>
        Continue with Google
      </button>
      <div v-if="googleAvailable" class="account-divider"><span>or use email</span></div>
      <p v-if="sent" class="notice" role="status">
        Check your email for a sign-in link. Open it to continue.
      </p>
      <form @submit.prevent="submit">
        <label class="field-label account-field"
          >Email<input
            v-model="email"
            type="email"
            autocomplete="email"
            required
            autofocus
            maxlength="254"
        /></label>
        <p v-if="error" role="alert">{{ error }}</p>
        <div class="dialog-actions">
          <button class="button primary" :disabled="busy">
            {{ busy ? 'Sending…' : sent ? 'Send another link' : 'Email me a sign-in link' }}
          </button>
        </div>
      </form>
      <p class="account-note">
        Scripts already saved on this device join your account after you sign in.
      </p>
    </Modal>
  </div>
</template>
