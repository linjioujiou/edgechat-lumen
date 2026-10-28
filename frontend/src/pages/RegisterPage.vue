<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ShieldCheck } from '@lucide/vue';
import api from '../api.js';
import store from '../store.js';
import { useI18n } from '../i18n.js';
import LanguageSwitch from '../components/ui/LanguageSwitch.vue';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const loading = ref(false);
const validating = ref(false);
const error = ref('');
const invite = ref(null);

const form = reactive({
  username: '',
  displayName: '',
  password: '',
  confirmPassword: ''
});

const token = computed(() => String(route.params.token || '').trim());

async function loadInvite() {
  validating.value = true;
  error.value = '';
  try {
    const payload = await api.getRegisterInvite(token.value);
    invite.value = payload.invite;
    if (payload.site) {
      store.setSite(payload.site);
    }
  } catch (currentError) {
    error.value = currentError.message;
  } finally {
    validating.value = false;
  }
}

async function submit() {
  if (form.password !== form.confirmPassword) {
    error.value = t('auth.passwordMismatch');
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    // 确认密码只用于本地一致性校验，不能作为注册字段发送给后端。
    await api.registerWithInvite(token.value, {
      username: form.username,
      displayName: form.displayName,
      password: form.password
    });
    router.push({ name: 'login', query: { registered: '1' } });
  } catch (currentError) {
    error.value = currentError.message;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadInvite();
});
</script>

<template>
  <div class="login-page">
    <div class="login-aura" aria-hidden="true"></div>
    <LanguageSwitch class="login-language-switch" />

    <main class="login-container">
      <div class="login-head">
        <img class="login-logo" src="/logo.svg" alt="" width="54" height="54" />
        <h1 class="login-title">{{ t('auth.welcomeBack') }}</h1>
        <p class="login-sub">{{ store.site.siteName }} · {{ t('auth.registerSubtitle') }}</p>
      </div>

      <p v-if="validating" class="info-text">{{ t('auth.validatingInvite') }}</p>
      <p v-else-if="invite?.note" class="info-text">{{ t('auth.invitationNote', { note: invite.note }) }}</p>

      <form v-if="invite" class="login-form" @submit.prevent="submit">
        <label class="login-field" style="--field-i: 0">
          <span class="login-field__label">{{ t('auth.username') }}</span>
          <input
            v-model.trim="form.username"
            class="login-input"
            autocomplete="username"
            name="username"
            required
            type="text"
          />
        </label>

        <label class="login-field" style="--field-i: 1">
          <span class="login-field__label">{{ t('auth.displayName') }}</span>
          <input
            v-model.trim="form.displayName"
            class="login-input"
            autocomplete="nickname"
            name="displayName"
            type="text"
          />
        </label>

        <label class="login-field" style="--field-i: 2">
          <span class="login-field__label">{{ t('auth.password') }}</span>
          <input
            v-model="form.password"
            class="login-input"
            autocomplete="new-password"
            name="password"
            required
            type="password"
          />
        </label>

        <label class="login-field" style="--field-i: 3">
          <span class="login-field__label">{{ t('auth.confirmPassword') }}</span>
          <input
            v-model="form.confirmPassword"
            class="login-input"
            autocomplete="new-password"
            name="confirmPassword"
            required
            type="password"
          />
        </label>

        <button class="login-btn" :disabled="loading" type="submit">
          <span v-if="loading" class="login-btn__spinner" aria-hidden="true"></span>
          {{ loading ? t('auth.registering') : t('auth.completeRegistration') }}
        </button>

        <p v-if="error" class="error-text" role="alert">{{ error }}</p>
      </form>

      <p v-else-if="error" class="error-text" role="alert">{{ error }}</p>

      <p class="login-foot">
        <ShieldCheck :size="13" aria-hidden="true" />
        {{ t('auth.trustLine') }}
      </p>
    </main>
  </div>
</template>
