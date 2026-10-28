<script setup>
import { AtSign, BellOff } from "@lucide/vue";
import { t } from "../../i18n.js";
import UiAvatar from "../ui/Avatar.vue";

defineProps({
	items: {
		type: Array,
		default: () => [],
	},
	activeKey: {
		type: String,
		default: "",
	},
	loading: {
		type: Boolean,
		default: false,
	},
	isRoomMuted: {
		type: Function,
		default: () => false,
	},
});

const emit = defineEmits(["select"]);
</script>

<template>
	<div class="sidebar-section sidebar-list">
		<div v-if="loading" class="sidebar-hint">
			{{ t("chat.loadingConversations") }}
		</div>
		<div v-else-if="!items.length" class="sidebar-hint">
			{{ t("chat.noConversations") }}
		</div>
		<button
			v-for="item in items"
			:key="item.key"
			type="button"
			class="sidebar-item"
			:class="{ 'sidebar-item--active': activeKey === item.key, 'sidebar-item--unread': item.unreadCount > 0 }"
			:aria-current="activeKey === item.key ? 'true' : undefined"
			:title="item.title"
			@click="emit('select', item)"
		>
			<UiAvatar
				:src="item.avatarUrl"
				:fallback="item.fallback?.[0] || '?'"
				size="sm"
			/>
			<div class="sidebar-label-group">
				<div class="sidebar-item__top">
					<strong>{{ item.title }}</strong>
					<span class="sidebar-item__time">{{ item.dateLabel }}</span>
				</div>
				<div class="sidebar-item__bottom">
					<p class="sidebar-item__preview">{{ item.subtitle }}</p>
					<span
						v-if="isRoomMuted(item)"
						class="sidebar-muted-indicator"
						:title="t('chat.muted')"
						:aria-label="t('chat.muted')"
					>
						<BellOff :size="14" aria-hidden="true" />
						</span>
						<span v-if="item.mentionUnreadCount > 0" class="sidebar-mention-badge">
							<AtSign :size="13" aria-hidden="true" />
							{{ t("chat.mentionedMe") }}
						</span>
						<span v-if="item.unreadCount > 0" class="sidebar-unread-badge">
						{{ item.unreadCount > 99 ? "99+" : item.unreadCount }}
					</span>
				</div>
			</div>
		</button>
	</div>
</template>

<style scoped>
/* ============================================================
   会话列表 · 行高 68px，选中态用强调色浅底而非竖条，
   未读用实心数字徽标，时间戳等宽对齐。
   ============================================================ */

.sidebar-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 2px 0 10px;
  scrollbar-gutter: stable;
  touch-action: pan-y;
}

.sidebar-list::-webkit-scrollbar {
  width: 8px;
}

.sidebar-list::-webkit-scrollbar-thumb {
  border: 3px solid transparent;
  border-radius: var(--radius-pill);
  background-clip: content-box;
  background-color: var(--chat-scrollbar);
}

.sidebar-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px 12px;
  color: var(--chat-subtle);
  font-size: var(--text-sm);
}

.sidebar-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  width: calc(100% - 16px);
  min-height: 66px;
  margin: 1px 8px;
  padding: 9px 11px;
  border: none;
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  touch-action: manipulation;
  transition:
    background-color var(--dur-2) var(--ease-standard),
    transform var(--dur-1) var(--ease-standard);
  animation: conv-in 380ms var(--ease-out) backwards;
}

/* 首屏级联入场：前 8 条依次浮现，之后的合并成同一拍，避免长列表等待 */
.sidebar-item:nth-child(1) { animation-delay: 30ms; }
.sidebar-item:nth-child(2) { animation-delay: 60ms; }
.sidebar-item:nth-child(3) { animation-delay: 90ms; }
.sidebar-item:nth-child(4) { animation-delay: 120ms; }
.sidebar-item:nth-child(5) { animation-delay: 150ms; }
.sidebar-item:nth-child(6) { animation-delay: 180ms; }
.sidebar-item:nth-child(7) { animation-delay: 210ms; }
.sidebar-item:nth-child(n + 8) { animation-delay: 240ms; }

@keyframes conv-in {
  from {
    opacity: 0;
    transform: translate3d(-6px, 0, 0);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.sidebar-item:hover {
  background: rgba(0, 0, 0, 0.042);
}

.sidebar-item:active {
  transform: scale(0.985);
  background: rgba(0, 0, 0, 0.06);
}

.sidebar-item--active,
.sidebar-item--active:hover {
  background: var(--chat-selected);
}

.sidebar-item:focus-visible {
  outline: 2px solid rgba(var(--site-brand-rgb, 0, 113, 227), 0.7);
  outline-offset: -2px;
}

/* biome-ignore lint/correctness/noUnknownPseudoClass: Vue deep selector */
.sidebar-item :deep(.ui-avatar) {
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  box-shadow: none;
  font-size: 0.76rem;
}

.sidebar-label-group {
  flex: 1;
  min-width: 0;
}

.sidebar-item__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.sidebar-item__top strong {
  overflow: hidden;
  color: var(--chat-ink);
  font-size: 14.5px;
  font-weight: 500;
  letter-spacing: -0.012em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-item__time {
  flex-shrink: 0;
  color: var(--chat-subtle);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

.sidebar-item__bottom {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin-top: 3px;
}

.sidebar-item__preview {
  flex: 1;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--chat-muted);
  font-size: 12.5px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-item--unread .sidebar-item__preview {
  color: var(--chat-ink);
}

.sidebar-item--unread .sidebar-item__top strong {
  font-weight: 640;
}

.sidebar-item--active .sidebar-item__top strong {
  color: var(--chat-accent-text);
}

.sidebar-item--unread .sidebar-item__time {
  color: var(--chat-accent-text);
  font-weight: 600;
}

.sidebar-muted-indicator {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  color: var(--chat-subtle);
}

.sidebar-unread-badge {
  animation: badge-pop 320ms var(--ease-spring) backwards;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  min-width: 19px;
  height: 19px;
  padding: 0 5px;
  border-radius: var(--radius-pill);
  background: var(--site-action-bg, var(--chat-accent));
  color: #fff;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-weight: 640;
  line-height: 1;
  letter-spacing: -0.01em;
}

@keyframes badge-pop {
  from { opacity: 0; transform: scale(0.6); }
  to { opacity: 1; transform: none; }
}

.sidebar-mention-badge {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 1px;
  color: var(--chat-danger);
  font-size: 11px;
  font-weight: 640;
  white-space: nowrap;
}

@media (max-width: 960px) {
  .sidebar-list {
    padding-bottom: max(10px, env(safe-area-inset-bottom));
    overscroll-behavior: contain;
    scrollbar-gutter: auto;
  }

  .sidebar-item {
    width: 100%;
    min-height: 68px;
    margin: 0;
    padding: 10px max(16px, env(safe-area-inset-right)) 10px
      max(14px, env(safe-area-inset-left));
    border-radius: 0;
  }

  .sidebar-item:active {
    transform: none;
  }

  /* 分隔线从正文起笔，避免头像和内容被整行边框割开 */
  .sidebar-item + .sidebar-item::before {
    content: "";
    position: absolute;
    top: 0;
    right: 16px;
    left: 68px;
    height: 1px;
    background: var(--chat-line);
  }

  .sidebar-item :deep(.ui-avatar) {
    width: 44px;
    height: 44px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar-item,
  .sidebar-unread-badge {
    animation: none;
  }

  .sidebar-item {
    transition: none;
  }

  .sidebar-item:active {
    transform: none;
  }
}
</style>
