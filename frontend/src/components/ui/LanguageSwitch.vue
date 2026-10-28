<script setup>
import { Check, Languages } from '@lucide/vue';
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { LOCALE_OPTIONS, useI18n } from '../../i18n.js';

const { locale, localeLoading, setLocale, t } = useI18n();
const root = ref(null);
const menuOpen = ref(false);

function closeMenu() {
  menuOpen.value = false;
}

async function toggleMenu() {
  menuOpen.value = !menuOpen.value;
  if (menuOpen.value) {
    await nextTick();
    root.value?.querySelector('[aria-current="true"]')?.focus();
  }
}

async function selectLocale(value) {
  if (value !== locale.value) await setLocale(value);
  closeMenu();
}

function handleOutsidePointer(event) {
  if (!root.value?.contains(event.target)) closeMenu();
}

onMounted(() => document.addEventListener('pointerdown', handleOutsidePointer));
onBeforeUnmount(() => document.removeEventListener('pointerdown', handleOutsidePointer));
</script>

<template>
  <div ref="root" class="language-switch-wrap" @keydown.esc="closeMenu">
    <button
      type="button"
      class="language-switch"
      :title="t('language.select')"
      :aria-label="t('language.select')"
      :aria-expanded="menuOpen"
      aria-haspopup="menu"
      @click="toggleMenu"
    >
      <Languages :size="21" aria-hidden="true" />
    </button>

    <div v-if="menuOpen" class="language-switch__menu" role="menu" :aria-label="t('language.select')">
      <button
        v-for="option in LOCALE_OPTIONS"
        :key="option.value"
        type="button"
        class="language-switch__option"
        role="menuitem"
        :aria-current="locale === option.value ? 'true' : undefined"
        :disabled="localeLoading"
        @click="selectLocale(option.value)"
      >
        <span :lang="option.value">{{ option.label }}</span>
        <Check v-if="locale === option.value" :size="16" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.language-switch-wrap {
  position: relative;
  display: inline-flex;
}

/* 语言切换是次要控件：默认无边框，悬停才浮出浅底，避免与主操作抢视觉重量。 */
.language-switch {
  width: 36px;
  min-width: 36px;
  height: 36px;
  display: inline-grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--lumen-ink-3, #6e6e73);
  cursor: pointer;
  touch-action: manipulation;
  transition:
    background-color var(--dur-2, 180ms) var(--ease-standard, ease),
    color var(--dur-2, 180ms) var(--ease-standard, ease),
    transform var(--dur-1, 110ms) var(--ease-standard, ease);
}

.language-switch:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--lumen-ink, #1d1d1f);
}

.language-switch:active {
  transform: scale(0.92);
}

.language-switch:focus-visible {
  outline: 2px solid rgba(var(--site-brand-rgb, 0, 113, 227), 0.7);
  outline-offset: 2px;
}

.language-switch__menu {
  position: absolute;
  z-index: 120;
  top: calc(100% + 6px);
  right: 0;
  width: 148px;
  padding: 5px;
  border: 1px solid var(--lumen-line, rgba(0, 0, 0, 0.08));
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.94);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  backdrop-filter: blur(28px) saturate(180%);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.16);
  animation: lang-menu-in 200ms var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)) both;
}

@keyframes lang-menu-in {
  from { opacity: 0; transform: translateY(-4px) scale(0.97); }
  to { opacity: 1; transform: none; }
}

.language-switch__option {
  width: 100%;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 9px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--lumen-ink, #1d1d1f);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--dur-1, 110ms) var(--ease-standard, ease);
}

.language-switch__option:hover,
.language-switch__option:focus-visible {
  outline: none;
  background: rgba(0, 0, 0, 0.05);
}

.language-switch__option[aria-current='true'] {
  color: var(--lumen-accent, #0071e3);
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .language-switch,
  .language-switch__menu {
    transition: none;
    animation: none;
  }
}
</style>
