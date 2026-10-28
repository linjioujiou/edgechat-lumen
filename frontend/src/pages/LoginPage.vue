<script setup>
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ShieldCheck } from '@lucide/vue';
import store from '../store.js';
import { useI18n } from '../i18n.js';
import LanguageSwitch from '../components/ui/LanguageSwitch.vue';
import { getStoredNativeServerOrigin, isCapacitorAndroid } from '../capacitor-platform.ts';
import { readLoginSubmission } from '../login-submission.ts';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const loading = ref(false);
const error = ref('');
const form = reactive({
  serverOrigin: getStoredNativeServerOrigin(),
  username: '',
  password: ''
});
const registered = computed(() => route.query.registered === '1');

async function submit(event) {
  loading.value = true;
  error.value = '';
  try {
    // Android WebView 的自动填充不一定触发 input 事件，提交时以输入框当前值为准。
    const submitted = new FormData(event.currentTarget);
    const { serverOrigin, credentials } = readLoginSubmission(submitted);
    if (isCapacitorAndroid) {
      await store.configureNativeServer(serverOrigin);
    }
    await store.login(credentials);
    router.push('/');
  } catch (currentError) {
    error.value = currentError.message === 'native_server_https_required'
      ? t('auth.serverHttpsRequired')
      : currentError.message === 'native_server_unavailable'
        ? t('auth.serverUnavailable')
        : currentError.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-aura" aria-hidden="true"></div>
    <LanguageSwitch class="login-language-switch" />

    <main class="login-container">
      <div class="login-head">
        <img class="login-logo" src="/logo.svg" alt="" width="54" height="54" />
        <h1 class="login-title">{{ t('auth.welcomeBack') }}</h1>
        <p class="login-sub">{{ store.site.siteName }} · {{ t('auth.loginSubtitle') }}</p>
      </div>

      <p v-if="registered" class="success-hint">{{ t('auth.registerSuccess') }}</p>

      <form class="login-form" @submit.prevent="submit">
        <label v-if="isCapacitorAndroid" class="login-field" style="--field-i: 0">
          <span class="login-field__label">{{ t('auth.serverOrigin') }}</span>
          <input
            v-model.trim="form.serverOrigin"
            class="login-input"
            :placeholder="t('auth.serverOrigin')"
            autocomplete="url"
            inputmode="url"
            name="serverOrigin"
            required
            type="url"
          />
        </label>

        <label class="login-field" style="--field-i: 1">
          <span class="login-field__label">{{ t('auth.account') }}</span>
          <input
            v-model.trim="form.username"
            class="login-input"
            autocomplete="username"
            name="username"
            required
            type="text"
          />
        </label>

        <label class="login-field" style="--field-i: 2">
          <span class="login-field__label">{{ t('auth.password') }}</span>
          <input
            v-model="form.password"
            class="login-input"
            autocomplete="current-password"
            name="password"
            required
            type="password"
          />
        </label>

        <button class="login-btn" :disabled="loading" type="submit">
          <span v-if="loading" class="login-btn__spinner" aria-hidden="true"></span>
          {{ loading ? t('auth.signingIn') : t('auth.signIn') }}
        </button>

        <p v-if="error" class="error-text" role="alert">{{ error }}</p>
      </form>

      <p class="login-foot">
        <ShieldCheck :size="13" aria-hidden="true" />
        {{ t('auth.secureChannel') }}
      </p>
    </main>
  </div>
</template>
