<script setup>
import { FlaskConical, RotateCcw, Star } from '@lucide/vue';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { resetRuntime } from '../../runtime.js';
import { t } from '../../i18n.js';

const open = ref(false);
const route = useRoute();
const router = useRouter();

const pages = [
  { labelKey: 'demo.chat', value: '/' },
  { labelKey: 'demo.contacts', value: '/contacts' },
  { labelKey: 'demo.settings', value: '/settings' },
  { labelKey: 'demo.dashboard', value: '/admin/dashboard' },
  { labelKey: 'demo.users', value: '/admin/users' },
  { labelKey: 'demo.invites', value: '/admin/invites' },
  { labelKey: 'demo.telegram', value: '/admin/telegram' },
  { labelKey: 'demo.site', value: '/admin/site' },
  { labelKey: 'admin.nav.maintenance', value: '/admin/maintenance' },
  { labelKey: 'demo.login', value: '/login' },
  { labelKey: 'demo.register', value: '/register/demo-invite' }
];

const currentPage = computed(() => {
  const match = pages.find((page) => page.value === route.path);
  return match?.value || '/';
});

function navigate(event) {
  void router.push(event.target.value);
}

function resetDemo() {
  resetRuntime();
  localStorage.removeItem('customBackground');
  window.location.assign('/');
}
</script>

<template>
  <aside class="demo-navigator" :aria-label="t('demo.navigation')">
    <Transition name="demo-panel">
      <div v-if="open" class="demo-navigator__panel">
        <span class="demo-navigator__badge">{{ t('demo.local') }}</span>
        <select :value="currentPage" :aria-label="t('demo.selectPage')" @change="navigate">
          <option v-for="page in pages" :key="page.value" :value="page.value">
            {{ t(page.labelKey) }}
          </option>
        </select>
        <div class="demo-navigator__row">
          <button type="button" class="demo-navigator__reset" :title="t('demo.reset')" :aria-label="t('demo.reset')" @click="resetDemo">
            <RotateCcw :size="15" aria-hidden="true" />
            <span>{{ t('demo.reset') }}</span>
          </button>
          <!-- 演示站访客刚体验完产品，是最可能点 Star 的人群；生产构建会静态删除整个 DemoNavigator。 -->
          <a
            class="demo-navigator__star"
            href="https://github.com/aozorae/Edgechat"
            target="_blank"
            rel="noopener noreferrer"
            :title="t('demo.star')"
            :aria-label="t('demo.star')"
          >
            <Star :size="14" aria-hidden="true" />
            <span>Star</span>
          </a>
        </div>
      </div>
    </Transition>

    <button
      type="button"
      class="demo-navigator__toggle"
      :class="{ 'demo-navigator__toggle--open': open }"
      :aria-expanded="open"
      :aria-label="t('demo.navigation')"
      :title="t('demo.navigation')"
      @click="open = !open"
    >
      <FlaskConical :size="15" aria-hidden="true" />
      <span>{{ t('demo.local') }}</span>
    </button>
  </aside>
</template>

<style scoped>
/* 演示导航：默认收成一个胶囊，点开后在它上方弹出面板。
   收起态只占 100×32，不会遮住任何真实控件。 */
.demo-navigator {
  position: fixed;
  left: 16px;
  bottom: max(16px, env(safe-area-inset-bottom));
  z-index: 10000;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  animation: demo-in 480ms var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)) 320ms both;
}

@keyframes demo-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}

.demo-navigator__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  height: 30px;
  width: 30px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  color: var(--lumen-ink-3, #6e6e73);
  font-size: 11.5px;
  font-weight: 550;
  letter-spacing: 0.01em;
  cursor: pointer;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 8px 24px rgba(0, 0, 0, 0.12);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  backdrop-filter: blur(24px) saturate(180%);
  transition:
    background-color var(--dur-2, 180ms) var(--ease-standard, ease),
    color var(--dur-2, 180ms) var(--ease-standard, ease),
    transform var(--dur-1, 110ms) var(--ease-standard, ease);
}

.demo-navigator__toggle span {
  display: none;
}

.demo-navigator__toggle--open {
  width: auto;
  gap: 6px;
  padding: 0 12px 0 10px;
}

.demo-navigator__toggle--open span {
  display: inline;
}

.demo-navigator__toggle:hover {
  background: rgba(255, 255, 255, 0.95);
  color: var(--lumen-ink, #1d1d1f);
}

.demo-navigator__toggle:active {
  transform: scale(0.96);
}

.demo-navigator__toggle--open {
  color: var(--lumen-accent, #0071e3);
  background: rgba(255, 255, 255, 0.95);
}

.demo-navigator__toggle:focus-visible {
  outline: 2px solid rgba(var(--site-brand-rgb, 0, 113, 227), 0.6);
  outline-offset: 2px;
}

.demo-navigator__panel {
  display: grid;
  gap: 8px;
  width: 194px;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 16px 40px rgba(0, 0, 0, 0.16);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  backdrop-filter: blur(30px) saturate(180%);
}

.demo-navigator__badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding-left: 2px;
  color: var(--lumen-ink-4, #86868b);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.demo-navigator__badge::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lumen-accent, #0071e3);
}

.demo-navigator select {
  width: 100%;
  height: 32px;
  padding: 0 8px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 9px;
  background: #fff;
  color: var(--lumen-ink, #1d1d1f);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.demo-navigator select:hover {
  border-color: rgba(0, 0, 0, 0.18);
}

.demo-navigator__row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.demo-navigator__reset {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 30px;
  border: 0;
  border-radius: 9px;
  background: rgba(0, 0, 0, 0.05);
  color: var(--lumen-ink-2, #424245);
  font-size: 11.5px;
  font-weight: 550;
  cursor: pointer;
  transition: background-color var(--dur-1, 110ms) var(--ease-standard, ease);
}

.demo-navigator__reset:hover {
  background: rgba(0, 0, 0, 0.09);
}

.demo-navigator__star {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 30px;
  padding: 0 10px;
  border-radius: 9px;
  background: rgba(255, 214, 10, 0.18);
  color: #7a5c00;
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1;
  text-decoration: none;
  cursor: pointer;
  transition: background-color var(--dur-1, 110ms) var(--ease-standard, ease);
}

.demo-navigator__star:focus-visible {
  outline: 2px solid rgba(122, 92, 0, 0.7);
  outline-offset: 2px;
}

.demo-navigator__star:hover {
  background: rgba(255, 214, 10, 0.32);
  text-decoration: none;
}

.demo-panel-enter-active {
  transition:
    opacity var(--dur-3, 280ms) var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)),
    transform var(--dur-3, 280ms) var(--ease-spring, cubic-bezier(0.34, 1.42, 0.64, 1));
  transform-origin: bottom left;
}

.demo-panel-leave-active {
  transition:
    opacity 130ms var(--ease-standard, ease),
    transform 130ms var(--ease-standard, ease);
  transform-origin: bottom left;
}

.demo-panel-enter-from,
.demo-panel-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.96);
}

@media (max-width: 640px) {
  /* 窄屏输入条占了左下角，胶囊改到"输入区上方右侧"，按 FAB 的常规位置放 */
  .demo-navigator {
    left: auto;
    right: 10px;
    bottom: calc(116px + env(safe-area-inset-bottom));
  }

  .demo-navigator__panel {
    width: 176px;
  }

  .demo-navigator__star {
    width: 44px;
    height: 44px;
    padding: 0;
  }

  .demo-navigator__star span {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .demo-navigator,
  .demo-panel-enter-active,
  .demo-panel-leave-active {
    animation: none;
    transition-duration: 1ms;
  }
}
</style>

<style>
/* 演示胶囊占用了左下角，把侧栏底部的用户区抬起来，避免互相遮挡 */
body:has(.demo-navigator) .right-sidebar-inner {
  padding-bottom: 44px;
}

body:has(.demo-navigator) .app-sidebar,
body:has(.demo-navigator) .admin-sidebar__body {
  padding-bottom: 44px;
}

@media (max-width: 640px) {
  /* 覆盖层或输入区展开时让位，避免遮挡真实功能 */
  body:has(.room-management-layer) .demo-navigator,
  body:has(.composer-rich-editor) .demo-navigator,
  body:has(.composer-attachment) .demo-navigator,
  body:has(.composer-reply) .demo-navigator {
    display: none;
  }
}
</style>
