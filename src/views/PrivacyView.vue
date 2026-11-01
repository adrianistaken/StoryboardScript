<template>
  <div class="privacy-page">
    <header class="privacy-header"><Brand /></header>
    <main id="main" class="privacy-content">
      <p class="privacy-kicker">STORYBOARD SCRIPT</p>
      <h1>Privacy Policy</h1>
      <p class="privacy-date">Effective October 31, 2026</p>
      <p>
        StoryboardScript turns scripts into editable storyboards. This policy explains how the app
        handles your information.
      </p>

      <h2>Information we use</h2>
      <p>
        Without an account, your projects and reference images stay in your browser. If you sign in,
        your projects and images are stored with Supabase so you can access them on other devices.
        PDF files are processed in your browser; the original PDF is not uploaded, but its script
        content is saved with your project.
      </p>
      <p>
        For sign-in, Supabase stores your email address, account ID, and session information. If you
        choose Google sign-in, Google provides your email and may provide your name and profile
        picture to Supabase. We use your email and account ID to identify your account and sync your
        projects. We do not access your Google password, Drive, or other Google files.
      </p>

      <h2>Service providers</h2>
      <p>
        Vercel hosts the website. Supabase handles accounts and stores synced projects and images.
        Google handles Google sign-in when you choose it. These providers process information needed
        to provide those services. We do not use your Google sign-in information for advertising.
      </p>

      <h2>Deletion and contact</h2>
      <p>
        Projects remain until you delete them. You can delete projects in the app or clear
        browser-only data in your browser. To request deletion of your account and its projects, or
        to ask a privacy question, email
        <a href="mailto:adrian.rodriguez.dev@gmail.com">adrian.rodriguez.dev@gmail.com</a> from
        your account email address. We will update this page if our data practices change.
      </p>
    </main>
    <footer class="privacy-footer"><RouterLink to="/">Back to StoryboardScript</RouterLink></footer>
  </div>
</template>

<script setup lang="ts">
import Brand from '../components/Brand.vue'
</script>
