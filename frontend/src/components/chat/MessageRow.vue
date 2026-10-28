<script setup lang="ts">
import { computed } from "vue";
import { Clock3, RotateCw } from "@lucide/vue";
import { formatTime, t } from "../../i18n.js";
import UiAvatar from "../ui/Avatar.vue";
import MessageAttachment from "./MessageAttachment.vue";
import MessageMarkdown from "./MessageMarkdown.vue";
import MessageReplyPreview from "./MessageReplyPreview.vue";
import SenderSourceBadge from "./SenderSourceBadge.vue";
import SenderTitleBadge from "./SenderTitleBadge.vue";
import type { MessageSender, MessageView } from "./message-view.ts";

const props = defineProps<{
	msg: MessageView;
	currentUserId?: number;
	isDirect: boolean;
	highlighted: boolean;
}>();
const emit = defineEmits<{
	profile: [sender: MessageSender];
	retry: [clientMessageId: string];
	reveal: [messageId: number | string | null | undefined];
	contextmenu: [event: MouseEvent, message: MessageView];
	"long-press": [event: PointerEvent, message: MessageView];
	"track-press": [event: PointerEvent];
	"cancel-press": [];
}>();

// 每行依赖自身消息，而不是整个列表；追加消息时旧行无需重新生成气泡。
const own = computed(() => props.msg.sender.kind !== "external"
	&& Number(props.msg.sender.id) === Number(props.currentUserId));
const time = computed(() => props.msg.createdAt ? formatTime(props.msg.createdAt) : "");
</script>

<template>
	<article :data-message-id="msg.id" class="message-row message-row--actionable" :class="{ 'message-row--own': own }">
		<button
			v-if="!own"
			type="button"
			class="profile-avatar-trigger message-avatar-trigger"
			:aria-label="t('profile.view', { name: msg.sender.displayName })"
			@click="emit('profile', msg.sender)"
		>
			<UiAvatar class="message-avatar" :src="msg.sender.avatarUrl" :alt="msg.sender.displayName" :fallback="msg.sender.displayName" size="sm" />
		</button>
		<div
			class="message-bubble"
			:class="{ 'message-bubble--with-attachment': msg.attachment, 'message-bubble--highlighted': highlighted }"
			@contextmenu="!msg.sendStatus && emit('contextmenu', $event, msg)"
			@pointerdown="!msg.sendStatus && emit('long-press', $event, msg)"
			@pointermove="emit('track-press', $event)"
			@pointerup="emit('cancel-press')"
			@pointercancel="emit('cancel-press')"
		>
			<div v-if="!isDirect && !own" class="message-sender-name">
				<span>{{ msg.sender.displayName }}</span>
				<SenderTitleBadge :identity="msg.sender" />
				<SenderSourceBadge :source="msg.sender.source" :instance="msg.sender.sourceInstance" />
			</div>
			<MessageReplyPreview
				v-if="msg.replyTo"
				class="message-bubble__reply"
				:reply="msg.replyTo"
				:clickable="!msg.replyTo.deleted"
				@reveal="emit('reveal', msg.replyToMessageId)"
			/>
			<MessageMarkdown v-if="msg.content" :content="msg.content" :mentions="msg.mentions" :current-user-id="currentUserId" />
			<MessageAttachment v-if="msg.attachment" :attachment="msg.attachment" />
			<div v-if="msg.sendStatus" class="message-delivery" role="status">
				<template v-if="msg.sendStatus === 'pending'"><Clock3 :size="13" /><span>{{ t('chat.messagePending') }}</span></template>
				<template v-else>
					<span>{{ msg.sendError || t('chat.messageUnconfirmed') }}</span>
					<button type="button" :aria-label="t('chat.retryMessage')" :title="t('chat.retryMessage')" @click="emit('retry', msg.clientMessageId!)"><RotateCw :size="16" /></button>
				</template>
			</div>
			<span v-else class="message-time">{{ time }}</span>
		</div>
	</article>
</template>

<style scoped>
/* ============================================================
   消息气泡 · 参照信息类原生应用
   入站：系统浅灰块，无边框；出站：强调蓝块，白字。
   圆角在"尾部"收窄到 6px，形成指向说话人的缺口。
   ============================================================ */

.message-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-bottom: 14px;
  width: 100%;
  justify-content: flex-start;
  animation: msg-in var(--dur-4) var(--ease-out) both;
}

@keyframes msg-in {
  from {
    opacity: 0;
    transform: translate3d(0, 8px, 0) scale(0.99);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.message-row--own {
  justify-content: flex-end;
}

.message-bubble--highlighted {
  outline: 2px solid rgba(var(--site-brand-rgb, 0, 113, 227), 0.45);
  outline-offset: 3px;
  transition: outline-color var(--dur-3) var(--ease-standard);
}

.message-avatar-trigger {
  position: relative;
  min-width: 34px;
  min-height: 34px;
  align-self: flex-end;
}

/* 扩大触摸命中区域，但不改变 32px 头像与气泡的排版 */
.message-avatar-trigger::before {
  content: "";
  position: absolute;
  inset: -6px;
  border-radius: 50%;
}

.message-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  box-shadow: none;
  font-size: 0.68rem;
}

.message-bubble {
  position: relative;
  min-width: 0;
  max-width: min(72%, 600px);
  padding: 10px 12px 8px;
  border-radius: 18px 18px 18px 5px;
  background: var(--chat-incoming);
  color: var(--chat-ink);
  border: none;
  word-break: break-word;
  box-shadow: none;
}

.message-row--actionable .message-bubble {
  touch-action: pan-y;
  -webkit-touch-callout: none;
}

.message-bubble--with-attachment {
  padding-bottom: 20px;
}

.message-row--own .message-bubble {
  background: var(--chat-outgoing);
  color: var(--chat-outgoing-ink);
  border-radius: 18px 18px 5px 18px;
}

.message-sender-name {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 3px;
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--chat-muted);
  overflow-wrap: anywhere;
  min-width: 0;
}

.message-time {
  position: absolute;
  right: 10px;
  bottom: 4px;
  font-size: 10px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--chat-subtle);
  white-space: nowrap;
  user-select: none;
}

.message-row--own .message-time {
  color: rgba(255, 255, 255, 0.92);
}

.message-bubble__reply {
  margin-bottom: 4px;
}

.message-delivery {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  margin-top: 4px;
  font-size: var(--text-2xs);
  color: var(--chat-muted);
}

.message-row--own .message-delivery {
  color: rgba(255, 255, 255, 0.86);
}

.message-delivery svg {
  flex-shrink: 0;
}

.message-delivery button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  margin: -8px -6px -8px 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.message-delivery button:hover {
  background: rgba(255, 255, 255, 0.18);
}

.message-delivery button:focus-visible {
  outline: 2px solid currentColor;
}

/* 出站气泡内的链接、代码需要反色，否则蓝底蓝字不可读 */
.message-row--own :deep(a) {
  color: #fff;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.message-row--own :deep(code) {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

@media (max-width: 960px) {
  .message-row {
    gap: 6px;
    margin-bottom: 10px;
  }

  .message-bubble {
    max-width: calc(100% - 42px);
    font-size: 15px;
  }
}

@media (max-width: 380px) {
  .message-bubble {
    max-width: calc(100% - 38px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .message-row {
    animation: none;
  }

  .message-bubble--highlighted {
    transition: none;
  }
}
</style>
