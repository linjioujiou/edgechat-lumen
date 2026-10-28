<script setup>
import { defineAsyncComponent } from 'vue';
import ChunkLoadNotice from './components/ChunkLoadNotice.vue';
import store from './store.js';
import { useI18n } from './i18n.js';

const { t } = useI18n();

const DemoNavigator = globalThis.__EDGECHAT_DEMO__
  ? defineAsyncComponent(() => import('./components/demo/DemoNavigator.vue'))
  : null;
</script>

<template>
  <div v-if="!store.ready" class="app-loading" role="status" aria-live="polite">
    <img class="app-loading__logo" src="/logo.svg" alt="" width="52" height="52" />
    <span class="app-loading__bar" aria-hidden="true"></span>
    <span class="app-loading__text">{{ t('common.loading') }}</span>
  </div>
  <router-view v-else v-slot="{ Component, route }">
    <Transition :name="route.meta.transition || 'page'" mode="out-in">
      <component :is="Component" :key="route.meta.workspace ? 'workspace' : route.path" />
    </Transition>
  </router-view>
  <component :is="DemoNavigator" v-if="DemoNavigator" />
  <ChunkLoadNotice />
</template>

<style>
/* 启动态：品牌标记 + 一条不确定进度条，避免空白等待 */
.app-loading {
  position: relative;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 18px;
  min-height: 100dvh;
  color: var(--lumen-ink-3, #6e6e73);
  font-size: 0.8125rem;
}

.app-loading__logo {
  width: 52px;
  height: 52px;
  border-radius: 15px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  animation: app-loading-pulse 1.8s cubic-bezier(0.32, 0.72, 0, 1) infinite;
}

@keyframes app-loading-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(0.94); opacity: 0.72; }
}

.app-loading__bar {
  position: relative;
  width: 120px;
  height: 3px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.07);
}

.app-loading__bar::after {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 40%;
  border-radius: inherit;
  background: var(--lumen-accent, #0071e3);
  animation: app-loading-slide 1.4s cubic-bezier(0.32, 0.72, 0, 1) infinite;
}

@keyframes app-loading-slide {
  from { transform: translateX(-100%); }
  to { transform: translateX(320%); }
}

/* 页面切换：淡出略快、淡入带 6px 上浮，方向感来自"新页面从下方来" */
.page-enter-active {
  transition:
    opacity 260ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
}

.page-leave-active {
  transition:
    opacity 150ms cubic-bezier(0.32, 0.72, 0, 1),
    transform 150ms cubic-bezier(0.32, 0.72, 0, 1);
}

.page-enter-from {
  opacity: 0;
  transform: translate3d(0, 6px, 0);
}

.page-leave-to {
  opacity: 0;
  transform: translate3d(0, -4px, 0);
}

@media (prefers-reduced-motion: reduce) {
  .app-loading__logo,
  .app-loading__bar::after {
    animation: none;
  }

  .page-enter-active,
  .page-leave-active {
    transition-duration: 1ms;
  }
}
</style>
