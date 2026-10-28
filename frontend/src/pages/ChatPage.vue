<script setup>
import { ArrowLeft, Ban, Bell, BellOff, ContactRound, Menu, MessageCircle, Phone, Settings, UsersRound } from '@lucide/vue';
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  consumeNativeRoomTarget,
  isCapacitorAndroid,
  NATIVE_ROOM_OPEN_EVENT
} from '../capacitor-platform.ts';
import { isDemoMode } from '../runtime.js';
import ConversationList from '../components/chat/ConversationList.vue';
import InAppNotificationStack from '../components/chat/InAppNotificationStack.vue';
import MessageList from '../components/chat/MessageList.vue';
import MessageComposer from '../components/chat/MessageComposer.vue';
import MessageContextMenu from '../components/chat/MessageContextMenu.vue';
import PinnedMessageBar from '../components/chat/PinnedMessageBar.vue';
import RoomBridgeNotice from '../components/chat/RoomBridgeNotice.vue';
import PublicGroupDiscovery from '../components/chat/PublicGroupDiscovery.vue';
import UiAvatar from '../components/ui/Avatar.vue';
import LanguageSwitch from '../components/ui/LanguageSwitch.vue';
import { useActiveRoom } from '../composables/useActiveRoom.js';
import { useBrowserNotifications } from '../composables/useBrowserNotifications.js';
import { useChatRoom } from '../composables/useChatRoom.js';
import { useChatSidebar } from '../composables/useChatSidebar.js';
import { useChatViewport } from '../composables/useChatViewport.js';
import { useConversationFlow } from '../composables/useConversationFlow.ts';
import { useConversationCreation } from '../composables/useConversationCreation.js';
import { useInAppNotifications } from '../composables/useInAppNotifications.ts';
import { useMessageContextMenu } from '../composables/useMessageContextMenu.ts';
import { useRoomManagement } from '../composables/useRoomManagement.js';
import { useUnreadInbox } from '../composables/useUnreadInbox.js';
import { useUserBlock } from '../composables/useUserBlock.ts';
import { useVoiceCall } from '../composables/useVoiceCall.ts';
import VoiceCallBar from '../components/chat/VoiceCallBar.vue';
import { resolveMentionUserIds } from '../mentions.ts';
import store from '../store.js';
import api from '../api.js';
import { useUserProfile } from '../composables/useUserProfile.ts';
import { useI18n } from '../i18n.js';

import '../styles/chat.css';
import '../styles/chat-messages.css';
import '../styles/chat-attachments.css';
import '../styles/chat-theme.css';
import '../styles/voice-call.css';

const AddConversationDialog = defineAsyncComponent(() => import('../components/chat/AddConversationDialog.vue'));
const CreateGroupDialog = defineAsyncComponent(() => import('../components/chat/CreateGroupDialog.vue'));
const GroupSettingsDialog = defineAsyncComponent(() => import('../components/chat/GroupSettingsDialog.vue'));
const MemberPanel = defineAsyncComponent(() => import('../components/chat/MemberPanel.vue'));
const MobileNavigationDrawer = defineAsyncComponent(() => import('../components/chat/MobileNavigationDrawer.vue'));
const PublicGroupJoinDialog = defineAsyncComponent(() => import('../components/chat/PublicGroupJoinDialog.vue'));
const UserProfileDialog = defineAsyncComponent(() => import('../components/chat/UserProfileDialog.vue'));
const ContactsPage = defineAsyncComponent(() => import('./ContactsPage.vue'));

const router = useRouter();
const route = useRoute();
const { t } = useI18n();
const error = ref('');
const activeRoom = ref(null);
const replyingTo = ref(null);
const messageComposer = ref(null);
const showMobileNavigation = ref(false);
const publicGroupPreview = ref(null);
const joiningPublicGroup = ref(false);
const session = computed(() => store.session);
const showAdminEntry = computed(() => Boolean(session.value?.canAccessAdmin));
const isContactsView = computed(() => route.name === 'contacts');
const contactsVisited = ref(isContactsView.value);
const inboxActiveRoom = computed(() => isContactsView.value ? null : activeRoom.value);

const { activeRoomKey, canManageActiveRoom, applyActiveChannel, selectDm, roomLabel, roomSubtitle } =
  useActiveRoom({ activeRoom });
const {
  isMobileViewport,
  mobileView,
  startViewportSync,
  stopViewportSync,
  openConversationView,
  returnToConversationList
} = useChatViewport({ activeRoom });
const activeRoomAvatar = computed(() => {
  if (!activeRoom.value) return '';
  return activeRoom.value.kind === 'dm'
    ? activeRoom.value.otherUser?.avatarUrl || ''
    : activeRoom.value.avatarUrl || '';
});

const {
  channels, dms, users, sidebarLoading, conversationItems, publicGroupItems,
  refreshSidebar, openConversation, joinPublicChannel, markConversationRead, applyConversationActivity
} = useChatSidebar({ applyActiveChannel, selectDm });
const { openConversationItem, openByIdentity, refreshAndOpen } = useConversationFlow({
  conversationItems,
  refreshSidebar,
  openConversation,
  openConversationView
});

const {
  notificationsEnabled,
  notificationStateLabel,
  notificationActionLabel,
  notificationToggleDisabled,
  syncNotificationPermission,
  toggleNotifications,
  isRoomMuted,
  toggleRoomMuted,
  shouldNotifyRoom,
  notifyRoom
} = useBrowserNotifications({
  userId: session.value?.userId,
  onOpenRoom: openRoomFromNotification
});
const activeRoomMuted = computed(() => isRoomMuted(activeRoom.value));
const {
  inAppNotifications,
  showInAppNotification,
  dismissInAppNotification,
  clearInAppNotifications
} = useInAppNotifications();

function notifyInAppRoom(event) {
  if (!shouldNotifyRoom(event)) return false;
  showInAppNotification(event);
  return true;
}

function openInAppNotification(notification) {
  dismissInAppNotification(notification.id);
  void openRoomFromNotification(notification.room);
}
const {
  isBlockedByMe: activeDmBlockedByMe,
  saving: userBlockSaving,
  toggleUserBlock,
  applyBlockState
} = useUserBlock({ activeRoom, dms, error });

function handleRoomActivity({ room, message }) {
  applyConversationActivity({
    kind: room.kind,
    roomId: room.id,
	    lastMessageAt: message.createdAt,
	    unreadCount: 0,
	    mentionUnreadCount: 0
  });
  markConversationRead(room.kind, room.id);
}

function handleRoomAccessRevoked(room) {
  const roomName = room.name || t('chat.privateGroup');
  error.value = room.kind === 'private'
    ? t('chat.roomAccessRevokedNamed', { name: roomName })
    : t('chat.roomAccessRevoked');
  activeRoom.value = null;
  returnToConversationList();
  void refreshSidebar();
}

const {
  messages, pinnedMessage, highlightedMessageId, loading, refreshing, refreshFailed, wsStatus, composerText, pendingAttachments, sending,
  messagesEl,
	  loadMessages, activateRoom, deactivateRoom, pauseRoom, disconnectSocket, sendMessage, sendVoiceMessage, deleteMessage,
	  pinMessage, unpinMessage, revealPinnedMessage,
	  revealMessage,
  uploadAttachment, clearAttachment, retryAttachment, retryMessage, loadOlder
} = useChatRoom({
  activeRoom,
  session,
  error,
  roomVisible: computed(() => !isContactsView.value),
  onRoomActivity: handleRoomActivity,
  onRoomAccessRevoked: handleRoomAccessRevoked
});

const voiceCall = useVoiceCall({ userId: session.value?.userId, error,
  shouldRing: call => !isRoomMuted({ kind: 'dm', id: call.roomId }),
  notifyIncoming: call => notifyRoom({ type: 'call_invite', room: { kind: 'dm', id: call.roomId, name: call.name } })
});
const callState = voiceCall.state;
const callMode = voiceCall.mode;
const { connectUnreadInbox, disconnectUnreadInbox } = useUnreadInbox({
  activeRoom: inboxActiveRoom,
  markConversationRead,
  applyConversationActivity,
  notifyInApp: notifyInAppRoom,
  notifySystem: notifyRoom,
  onCallEvent: voiceCall.receive
});

const wsConnected = computed(() => wsStatus.value === 'open');
const activeRoomSubtitle = computed(() => roomSubtitle(activeRoom.value, wsConnected.value));
const canModerateMessages = computed(
  () => Boolean(activeRoom.value?.kind !== 'dm' && canManageActiveRoom.value)
);
const canPinMessages = computed(
  () => Boolean(activeRoom.value?.kind !== 'dm' && canManageActiveRoom.value)
);
const {
  messageMenu,
  closeMessageMenu,
  cancelMessageLongPress,
  openMessageContextMenu,
  startMessageLongPress,
  trackMessageLongPress
} = useMessageContextMenu();
const selectedMessageIsPinned = computed(
  () => Number(messageMenu.value.message?.id) === Number(pinnedMessage.value?.id)
);

const roomManagement = useRoomManagement({
  activeRoom, channels, users, error, refreshSidebar, refreshAndOpen, canManageActiveRoom,
  returnToConversationList,
  onRoomDeleted: () => {
    disconnectSocket();
    messages.value = [];
    pinnedMessage.value = null;
  }
});
const { creation, members: memberManagement, settings: groupSettings, deleteGroup } = roomManagement;
const {
  show: showCreateGroup,
  form: createGroupForm,
  submitting: creatingGroup,
  open: openCreateGroup,
  close: closeCreateGroup,
  toggleMember: toggleCreateGroupMember,
  submit: createGroup
} = creation;
const {
  show: showAddConversation,
  usersWithoutDm,
  openingDmUserId,
  open: openAddConversation,
  close: closeAddConversation,
  startGroupCreation,
  openDm
} = useConversationCreation({
  users,
  dms,
  error,
  refreshAndOpen,
  openGroupDialog: openCreateGroup
});
const {
  show: showMemberPanel,
  items: groupMembers,
  loading: memberLoading,
  inviteUserId,
  availableUsers: availableInviteUsers,
  inviteSubmitting,
  toggle: toggleMemberPanel,
  close: closeMemberPanel,
  invite: inviteMember,
  remove: removeMember
} = memberManagement;
const mentionCandidates = computed(() =>
	activeRoom.value?.kind === 'dm'
		? []
		: groupMembers.value.filter((member) => Number(member.id) !== Number(session.value?.userId))
);
const profileTargetHeader = ref(null);
const {
  identity: profileIdentity, profile: userProfile, show: showUserProfile,
  loading: profileLoading, unavailable: profileUnavailable, error: profileError,
  submitting: profileSubmitting, restoreFocus: profileRestoreFocus, isSelf: profileIsSelf,
  openUserProfile, close: closeUserProfile, retry: retryUserProfile, sendMessage: sendProfileMessage
} = useUserProfile({
  currentUserId: computed(() => session.value?.userId),
  getProfile: api.getUserProfile,
  openDm,
  onNavigate: () => {
    closeMemberPanel();
    void router.push('/').then(() => nextTick(() => {
      messageComposer.value?.focus();
      // 被拉黑会话的输入区不可聚焦时，仍把焦点移到目标会话而非旧头像。
      if (!document.activeElement?.closest('.message-composer')) profileTargetHeader.value?.focus();
    }));
  }
});
function openLocalUserProfile(user) {
  if (user) openUserProfile({ ...user, kind: 'local' });
}
function openSenderProfile(sender) {
  closeMessageMenu();
  openUserProfile(sender.kind === 'external'
    ? { kind: 'external', source: sender.source, id: String(sender.id), displayName: sender.displayName, avatarUrl: sender.avatarUrl }
    : { ...sender, kind: 'local' });
}
function editProfile() {
  profileRestoreFocus.value = false;
  closeUserProfile();
  void router.push('/settings');
}
watch(() => session.value?.userId, closeUserProfile);

async function sendComposerMessage() {
	const sent = await sendMessage(
		resolveMentionUserIds(composerText.value, mentionCandidates.value, session.value?.userId),
		replyingTo.value?.id,
	);
	if (sent) replyingTo.value = null;
	return sent;
}

async function sendComposerVoice(recording) {
	const sent = await sendVoiceMessage(recording, replyingTo.value?.id);
	if (sent) replyingTo.value = null;
	return sent;
}
const {
  show: showGroupEditor,
  form: groupSettingsForm,
  saving: groupSettingsSaving,
  avatarUploading: groupAvatarUploading,
  open: openGroupEditor,
  close: closeGroupEditor,
  uploadAvatar: uploadGroupAvatar,
  save: saveGroupSettings
} = groupSettings;

async function selectConversation(item) {
  try {
    await openConversationItem(item);
  } catch (currentError) {
    error.value = currentError.message;
  }
}

function openPublicGroupPreview(item) {
  publicGroupPreview.value = item.source;
}

function closePublicGroupPreview() {
  if (!joiningPublicGroup.value) publicGroupPreview.value = null;
}

async function confirmPublicGroupJoin() {
  const channel = publicGroupPreview.value;
  if (!channel) return;

  joiningPublicGroup.value = true;
  error.value = '';
  try {
    await joinPublicChannel(channel);
    publicGroupPreview.value = null;
    await openByIdentity(channel);
  } catch (currentError) {
    error.value = currentError.message;
  } finally {
    joiningPublicGroup.value = false;
  }
}

async function openRoomFromNotification(room) {
  try {
    await openByIdentity(room);
    await router.push('/');
  } catch (currentError) {
    error.value = currentError.message;
  }
}

function toggleActiveRoomMute() {
  if (activeRoom.value) toggleRoomMuted(activeRoom.value);
}

async function logout() { await voiceCall.hangup(); await store.logout(); router.push('/login'); }
function openAdmin() { router.push('/admin'); }
function openSettings() { router.push('/settings'); }
function openChat() { router.push('/'); }
function openContacts() { router.push('/contacts'); }
let nativeRoomNavigationReady = false;
function openNativeRoom() {
  if (!nativeRoomNavigationReady) return;
  const target = consumeNativeRoomTarget();
  if (target) void openRoomFromNotification(target);
}
function closeMobileNavigation() { showMobileNavigation.value = false; }
function navigateFromMobileDrawer(callback) {
  closeMobileNavigation();
  callback();
}
function returnToMobileConversationList() {
  closeMemberPanel();
  closeMessageMenu();
  replyingTo.value = null;
  returnToConversationList();
}

async function bootstrap() {
  error.value = '';
  try {
    await refreshSidebar();
    if (isDemoMode && !activeRoom.value) {
      const general = conversationItems.value.find((item) => item.isGeneral);
      if (general) await selectConversation(general);
    }
  }
  catch (e) { error.value = e.message; }
}

watch(activeRoomKey, async (k) => {
  closeMessageMenu();
  cancelMessageLongPress();
  replyingTo.value = null;
  if (!k) {
    deactivateRoom();
    return;
  }
	  if (isContactsView.value) {
	    pauseRoom();
	    return;
	  }
  openConversationView();
  const loaded = await activateRoom();
  if (!loaded || activeRoomKey.value !== k) return;
  for (const delay of [0, 50, 150, 300]) {
    await new Promise(r => setTimeout(r, delay));
    if (activeRoomKey.value !== k) return;
    if (messagesEl.value) {
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
    }
  }
});

watch(isContactsView, async (showContacts, wasContacts) => {
  if (showContacts) {
    contactsVisited.value = true;
    closeMessageMenu();
	    cancelMessageLongPress();
	    closeMemberPanel();
	    pauseRoom();
	    return;
  }
  if (wasContacts && activeRoom.value) {
    openConversationView();
    await activateRoom();
  }
});

function confirmDeleteMessage() {
  const message = messageMenu.value.message;
  closeMessageMenu();
  if (!message || !window.confirm(t('chat.deleteMessageConfirm'))) {
    return;
  }
  deleteMessage(message.id);
}

function pinSelectedMessage() {
  const message = messageMenu.value.message;
  closeMessageMenu();
  if (message) pinMessage(message.id);
}

function unpinSelectedMessage() {
  const message = messageMenu.value.message;
  closeMessageMenu();
  if (message) unpinMessage(message.id);
}

function replyToSelectedMessage() {
	const message = messageMenu.value.message;
	closeMessageMenu();
	if (!message) return;
	replyingTo.value = message;
	nextTick(() => messageComposer.value?.focus());
}

async function copySelectedMessage() {
	const content = String(messageMenu.value.message?.content || '');
	closeMessageMenu();
	if (!content) return;
	try {
		await navigator.clipboard.writeText(content);
	} catch {
		error.value = t('messages.copyFailed');
	}
}

onMounted(() => {
  window.addEventListener('pagehide', voiceCall.hangup);
  startViewportSync();
  window.addEventListener('focus', syncNotificationPermission);
  window.addEventListener(NATIVE_ROOM_OPEN_EVENT, openNativeRoom);
  void bootstrap().then(() => {
    nativeRoomNavigationReady = true;
    connectUnreadInbox();
    openNativeRoom();
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('pagehide', voiceCall.hangup);
  void voiceCall.hangup();
  closeUserProfile();
  cancelMessageLongPress();
  nativeRoomNavigationReady = false;
  window.removeEventListener('focus', syncNotificationPermission);
  window.removeEventListener(NATIVE_ROOM_OPEN_EVENT, openNativeRoom);
  clearInAppNotifications();
  disconnectUnreadInbox();
  disconnectSocket();
  stopViewportSync();
});
// 首次使用后保留弹窗实例，关闭时才能完成退场动画并恢复触发按钮焦点。
const visitedOverlays = reactive(new Set());
watch(
  () => ({
    mobileNavigation: showMobileNavigation.value,
    userProfile: showUserProfile.value,
    addConversation: showAddConversation.value,
    createGroup: showCreateGroup.value,
    publicGroupJoin: publicGroupPreview.value,
    groupSettings: showGroupEditor.value,
  }),
  (states) => {
    for (const [name, open] of Object.entries(states)) {
      if (open) visitedOverlays.add(name);
    }
  },
  { immediate: true }
);
</script>

<template>
  <div
    class="chat-layout"
    :class="{
      'chat-layout--mobile': isMobileViewport,
      'chat-layout--mobile-list': isMobileViewport && mobileView === 'list',
      'chat-layout--mobile-chat': isMobileViewport && mobileView === 'chat',
      'chat-layout--calling': Boolean(callState.call),
      'chat-layout--contacts': isContactsView
    }"
  >
    <!-- 导航与会话列表保持独立，切换通讯录时不破坏现有聊天工作区。 -->
    <aside class="right-sidebar">
      <div class="right-sidebar-inner">
        <div class="right-sidebar-section right-sidebar-actions">
          <button
            type="button"
            class="right-sidebar-action right-sidebar-action--labeled tooltip"
            :class="{ 'right-sidebar-action--current': !isContactsView }"
            :data-tooltip="t('nav.chats')"
            :aria-label="t('nav.chats')"
            :aria-current="!isContactsView ? 'page' : undefined"
            @click="openChat"
          >
            <MessageCircle :size="20" aria-hidden="true" />
            <span class="right-sidebar-action__label">{{ t('nav.chats') }}</span>
          </button>
          <button
            type="button"
            class="right-sidebar-action right-sidebar-action--labeled tooltip"
            :class="{ 'right-sidebar-action--current': isContactsView }"
            :data-tooltip="t('contacts.title')"
            :aria-label="t('contacts.title')"
            :aria-current="isContactsView ? 'page' : undefined"
            @click="openContacts"
          >
            <ContactRound :size="20" aria-hidden="true" />
            <span class="right-sidebar-action__label">{{ t('contacts.title') }}</span>
          </button>
          <button
            type="button"
            class="right-sidebar-action right-sidebar-action--labeled right-sidebar-action--settings tooltip"
            :data-tooltip="t('nav.personalSettings')"
            :aria-label="t('nav.personalSettings')"
            @click="openSettings"
          >
            <Settings :size="20" aria-hidden="true" />
            <span class="right-sidebar-action__label">{{ t('nav.personalSettings') }}</span>
          </button>
          <button
            type="button"
            class="right-sidebar-action right-sidebar-action--labeled tooltip"
            :class="{ 'right-sidebar-action--notification-active': notificationsEnabled }"
            :data-tooltip="notificationActionLabel"
            :aria-label="notificationActionLabel"
            :aria-pressed="notificationsEnabled"
            :disabled="notificationToggleDisabled"
            @click="toggleNotifications"
          >
            <Bell v-if="notificationsEnabled" :size="20" aria-hidden="true" />
            <BellOff v-else :size="20" aria-hidden="true" />
            <span class="right-sidebar-action__label">{{ notificationStateLabel }}</span>
          </button>
          <button
            v-if="showAdminEntry"
            type="button"
            class="right-sidebar-action right-sidebar-action--admin tooltip"
            :data-tooltip="t('nav.admin')"
            :aria-label="t('nav.admin')"
            @click="openAdmin"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8">
              <title>{{ t('nav.admin') }}</title>
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
            <span class="right-sidebar-action__label">{{ t('nav.admin') }}</span>
          </button>
        </div>

        <div class="right-sidebar-section right-sidebar-user-group">
          <button type="button" class="right-sidebar-user tooltip" :data-tooltip="t('nav.personalSettings')" :aria-label="t('nav.personalSettings')" @click="router.push('/settings')">
            <UiAvatar :src="session?.avatarUrl" :fallback="session?.displayName?.[0] || 'U'" size="sm" />
          </button>
          <button type="button" class="right-sidebar-action right-sidebar-action--danger tooltip" :data-tooltip="t('auth.signOut')" :aria-label="t('auth.signOut')" @click="logout">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8">
              <title>{{ t('auth.signOut') }}</title>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>

	    <!-- 会话区保持固定视觉层级，让标题与列表在不同宽度下都有稳定位置。 -->
    <aside class="left-sidebar">
      <div class="sidebar-inner">
        <div class="sidebar-header">
          <button
            type="button"
            class="header-action mobile-menu-action"
            :aria-label="t('nav.openNavigation')"
            :aria-expanded="showMobileNavigation"
            @click="showMobileNavigation = true"
          >
            <Menu :size="22" aria-hidden="true" />
          </button>
          <h1 class="brand-title">EdgeChat</h1>
          <div class="sidebar-header-actions">
            <button
              type="button"
              class="header-action header-action--primary"
              :title="t('chat.addPeople')"
              :aria-label="t('chat.addPeople')"
              aria-haspopup="dialog"
              :aria-expanded="showAddConversation"
              @click="openAddConversation"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <title>{{ t('chat.addPeople') }}</title>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            </button>
            <LanguageSwitch class="mobile-language-switch" />
          </div>
        </div>

        <div class="sidebar-list-heading">
          <h2>{{ t('nav.chats') }}</h2>
          <span>{{ conversationItems.length }}</span>
        </div>

		<ConversationList
		  :items="conversationItems"
		  :active-key="activeRoomKey"
		  :loading="sidebarLoading"
		  :is-room-muted="isRoomMuted"
		  @select="selectConversation"
		/>

		<PublicGroupDiscovery :items="publicGroupItems" @select="openPublicGroupPreview" />
      </div>
    </aside>

    <ContactsPage
      v-if="contactsVisited"
      v-show="isContactsView"
      :visible="isContactsView"
      @open-navigation="showMobileNavigation = true"
      @open-profile="openLocalUserProfile"
      @unblocked="applyBlockState($event, false)"
    />

    <!-- Right Main Chat Window -->
    <main v-if="!isContactsView" class="chat-main">
      <template v-if="activeRoom">
        <header class="chat-header" :class="{ 'chat-header--dm': activeRoom.kind === 'dm' && !isCapacitorAndroid }">
          <button
            type="button"
            class="chat-header__back"
            :aria-label="t('chat.backToConversationList')"
            @click="returnToMobileConversationList"
          >
            <ArrowLeft :size="24" aria-hidden="true" />
          </button>
          <button
            v-if="activeRoom.kind === 'dm'"
            ref="profileTargetHeader"
            type="button"
            class="profile-avatar-trigger"
            :aria-label="t('profile.view', { name: roomLabel(activeRoom) })"
            @click="openLocalUserProfile(activeRoom.otherUser)"
          >
            <UiAvatar :src="activeRoomAvatar" :fallback="roomLabel(activeRoom)?.[0] || '?'" size="sm" />
          </button>
          <UiAvatar
            v-else
            class="chat-header__avatar"
            :src="activeRoomAvatar"
            :fallback="roomLabel(activeRoom)?.[0] || '?'"
            size="sm"
          />
          <div class="chat-header__identity">
            <h2>{{ roomLabel(activeRoom) }}</h2>
            <span>{{ activeRoomSubtitle }}</span>
          </div>
          <div class="chat-header__actions">
            <div v-if="activeRoom.kind === 'dm' && !isCapacitorAndroid" class="chat-call-controls">
              <button type="button" class="chat-header__button" :title="t('call.voice')" :aria-label="t('call.voice')" :disabled="Boolean(callState.call) || activeDmBlockedByMe" @click="voiceCall.start(activeRoom)"><Phone :size="19" aria-hidden="true" /></button>
              <select class="chat-call-mode" :value="callMode" :aria-label="t('call.mode')" :title="t('call.mode')" :disabled="['permission', 'calling'].includes(callState.phase)" @change="voiceCall.changeMode($event.target.value)">
                <option value="auto">P2P</option><option value="relay">TURN</option>
              </select>
            </div>
            <div
              class="chat-header__status"
              :class="wsConnected ? 'online' : 'offline'"
              :title="wsConnected ? t('chat.connected') : t('chat.connecting')"
              :aria-label="wsConnected ? t('chat.connected') : t('chat.connecting')"
              role="status"
            ></div>
            <button
              v-if="activeRoom.kind === 'dm'"
              type="button"
              class="chat-header__button chat-header__button--danger"
              :class="{ 'chat-header__button--blocked': activeDmBlockedByMe }"
              :title="activeDmBlockedByMe ? t('chat.unblockUser') : t('chat.blockUser')"
              :aria-label="activeDmBlockedByMe ? t('chat.unblockUser') : t('chat.blockUser')"
              :aria-pressed="activeDmBlockedByMe"
              :aria-busy="userBlockSaving"
              :disabled="userBlockSaving"
              @click="toggleUserBlock"
            >
              <Ban :size="19" aria-hidden="true" />
              <span>{{ activeDmBlockedByMe ? t('chat.unblock') : t('chat.block') }}</span>
            </button>
            <button
              type="button"
              class="chat-header__button"
              :class="{ 'chat-header__button--active': activeRoomMuted }"
              :title="activeRoomMuted ? t('chat.unmuteCurrent') : t('chat.muteCurrent')"
              :aria-label="activeRoomMuted ? t('chat.unmuteCurrent') : t('chat.muteCurrent')"
              :aria-pressed="activeRoomMuted"
              @click="toggleActiveRoomMute"
            >
              <BellOff v-if="activeRoomMuted" :size="19" aria-hidden="true" />
              <Bell v-else :size="19" aria-hidden="true" />
              <span>{{ activeRoomMuted ? t('chat.mutedShort') : t('chat.mute') }}</span>
            </button>
            <button
              v-if="activeRoom.kind !== 'dm'"
              type="button"
              class="chat-header__button"
              :aria-label="showMemberPanel ? t('chat.closeMembers') : t('chat.viewMembers')"
              :aria-expanded="showMemberPanel"
              :title="showMemberPanel ? t('chat.closeMembers') : t('chat.viewMembers')"
              @click="toggleMemberPanel"
            >
              <UsersRound :size="19" aria-hidden="true" />
              <span>{{ showMemberPanel ? t('chat.collapseMembers') : t('chat.members') }}</span>
            </button>
            <button
              v-if="canManageActiveRoom"
              type="button"
              class="chat-header__button"
              :aria-label="t('chat.openGroupSettings')"
              :title="t('chat.openGroupSettings')"
              @click="openGroupEditor"
            >
              <Settings :size="19" aria-hidden="true" />
              <span>{{ t('chat.groupSettings') }}</span>
            </button>
            <LanguageSwitch class="chat-header__language-switch" />
          </div>
        </header>

        <RoomBridgeNotice v-if="activeRoom.kind !== 'dm'" :room-id="Number(activeRoom.id)" />
        <PinnedMessageBar
          v-if="pinnedMessage && activeRoom.kind !== 'dm'"
          :message="pinnedMessage"
          :can-unpin="canPinMessages"
          @reveal="revealPinnedMessage"
          @unpin="unpinMessage(pinnedMessage.id)"
        />

        <div v-if="refreshing || refreshFailed" class="messages-refresh-status" role="status">
          <span>{{ refreshing ? t('common.refreshing') : t('chat.refreshFailed') }}</span>
          <button v-if="refreshFailed" type="button" @click="loadMessages()">{{ t('common.retry') }}</button>
        </div>
        <section ref="messagesEl" class="chat-messages">
          <button v-if="messages.length" type="button" class="load-more-btn" :disabled="loading" @click="loadOlder">{{ t('chat.loadEarlier') }}</button>
          <div v-if="loading && !refreshing" class="messages-hint">{{ t('chat.loadingMessages') }}</div>
          <div v-else-if="!messages.length && !loading && !refreshFailed" class="messages-hint">{{ t('chat.noMessages') }}</div>

          <MessageList
            :messages="messages"
            :current-user-id="session?.userId"
            :is-direct="activeRoom.kind === 'dm'"
            :highlighted-message-id="highlightedMessageId"
            @profile="openSenderProfile"
            @retry="retryMessage"
            @reveal="revealMessage"
            @contextmenu="openMessageContextMenu"
            @long-press="startMessageLongPress"
            @track-press="trackMessageLongPress"
            @cancel-press="cancelMessageLongPress"
          />
        </section>

        <MessageContextMenu
          :open="Boolean(messageMenu.message)"
          :x="messageMenu.x"
          :y="messageMenu.y"
		  :can-pin="canPinMessages"
			  :can-delete="canModerateMessages"
			  :can-copy="Boolean(messageMenu.message?.content)"
			  :pinned="selectedMessageIsPinned"
			  @close="closeMessageMenu"
			  @copy="copySelectedMessage"
			  @reply="replyToSelectedMessage"
          @pin="pinSelectedMessage"
          @unpin="unpinSelectedMessage"
          @delete="confirmDeleteMessage"
        />

		<MessageComposer
		  ref="messageComposer"
		  v-model="composerText"
		  :pending-attachments="pendingAttachments"
		  :sending="sending"
			  :disabled="!activeRoom || activeDmBlockedByMe"
			  :error="error"
			  :mention-candidates="mentionCandidates"
			  :replying-to="replyingTo"
			  :context-key="activeRoomKey"
			  @send="sendComposerMessage"
			  @voice-recorded="sendComposerVoice"
			  @cancel-reply="replyingTo = null"
		  @upload="uploadAttachment"
		  @clear-attachment="clearAttachment"
		  @retry-attachment="retryAttachment"
		/>
      </template>

      <div v-else class="chat-empty">
        <LanguageSwitch class="chat-empty__language-switch" />
        <div class="empty-content">
          <div class="empty-brand">
            <MessageCircle :size="36" :stroke-width="1.5" aria-hidden="true" />
            <span class="empty-title">EdgeChat</span>
          </div>
          <p>{{ t('chat.noConversationSelected') }}</p>
          <button type="button" class="empty-start" @click="openAddConversation">
            <MessageCircle :size="18" aria-hidden="true" />
            {{ t('chat.addPeople') }}
          </button>
        </div>
      </div>
    </main>

    <div v-if="!isContactsView && showMemberPanel" class="room-management-layer" @click.self="closeMemberPanel">
      <aside class="room-management-sidebar">
        <MemberPanel
          :room="activeRoom"
          :members="groupMembers"
          :loading="memberLoading"
          :can-manage="canManageActiveRoom"
          :invite-user-id="inviteUserId"
          :available-invite-users="availableInviteUsers"
          :invite-submitting="inviteSubmitting"
          @close="closeMemberPanel"
          @update:invite-user-id="inviteUserId = $event"
          @invite="inviteMember"
          @remove-member="removeMember"
          @open-profile="openLocalUserProfile"
          @delete-group="deleteGroup"
        />
      </aside>
    </div>

    <VoiceCallBar :state="callState" @accept="voiceCall.accept" @hangup="voiceCall.hangup" @mute="voiceCall.toggleMute" @play="voiceCall.play" />
    <MobileNavigationDrawer
      v-if="visitedOverlays.has('mobileNavigation')"
      :show="showMobileNavigation"
      :session="session"
      :show-admin="showAdminEntry"
      :notifications-enabled="notificationsEnabled"
      :notification-label="notificationActionLabel"
      :notification-disabled="notificationToggleDisabled"
      :active-view="isContactsView ? 'contacts' : 'chat'"
      @close="closeMobileNavigation"
      @chat="navigateFromMobileDrawer(openChat)"
      @contacts="navigateFromMobileDrawer(openContacts)"
      @settings="navigateFromMobileDrawer(openSettings)"
      @admin="navigateFromMobileDrawer(openAdmin)"
      @notification="toggleNotifications"
      @logout="navigateFromMobileDrawer(logout)"
    />

    <UserProfileDialog
      v-if="visitedOverlays.has('userProfile')"
      :show="showUserProfile"
      :identity="profileIdentity"
      :profile="userProfile"
      :loading="profileLoading"
      :unavailable="profileUnavailable"
      :error="profileError"
      :submitting="profileSubmitting"
      :restore-focus="profileRestoreFocus"
      :is-self="profileIsSelf"
      @close="closeUserProfile"
      @retry="retryUserProfile"
      @send-message="sendProfileMessage"
      @edit="editProfile"
    />
    <AddConversationDialog
      v-if="visitedOverlays.has('addConversation')"
      :show="showAddConversation"
      :users="usersWithoutDm"
      :opening-dm-user-id="openingDmUserId"
      :error="error"
      @close="closeAddConversation"
      @create-group="startGroupCreation"
      @open-dm="openDm"
    />

    <CreateGroupDialog
      v-if="visitedOverlays.has('createGroup')"
      :show="showCreateGroup"
      :users="users"
      :form="createGroupForm"
      :submitting="creatingGroup"
      :error="error"
      @close="closeCreateGroup"
      @toggle-member="toggleCreateGroupMember"
      @submit="createGroup"
    />

    <PublicGroupJoinDialog
      v-if="visitedOverlays.has('publicGroupJoin')"
      :show="Boolean(publicGroupPreview)"
      :channel="publicGroupPreview"
      :joining="joiningPublicGroup"
      @close="closePublicGroupPreview"
      @join="confirmPublicGroupJoin"
    />

    <GroupSettingsDialog
      v-if="visitedOverlays.has('groupSettings')"
      :show="showGroupEditor"
      :room="activeRoom"
      :form="groupSettingsForm"
      :saving="groupSettingsSaving"
      :avatar-uploading="groupAvatarUploading"
      @close="closeGroupEditor"
      @upload-avatar="uploadGroupAvatar"
      @save="saveGroupSettings"
    />
    <InAppNotificationStack
      :notifications="inAppNotifications"
      @open="openInAppNotification"
      @dismiss="dismissInAppNotification"
    />
  </div>
</template>

<style scoped>
/* ============================================================
   聊天工作区 · 外壳
   三栏：图标栏 / 会话栏 / 消息区。层次靠底色深浅 + 发丝线，
   不用大面积投影；所有交互反馈限制在 110–280ms。
   ============================================================ */

.chat-layout {
  position: fixed;
  top: var(--chat-viewport-offset-top, 0px);
  left: 0;
  display: flex;
  width: 100%;
  height: var(--chat-viewport-height, 100dvh);
  min-height: 100dvh;
  overflow: hidden;
  background: var(--site-background, var(--chat-canvas));
  color: var(--chat-ink);
  font-family: var(--chat-font);
  letter-spacing: normal;
}

.chat-layout--calling {
  top: calc(var(--chat-viewport-offset-top, 0px) + 64px);
  height: calc(var(--chat-viewport-height, 100dvh) - 64px);
  min-height: 0;
}

/* ---------- 图标栏 ---------- */
.right-sidebar {
  flex-shrink: 0;
  width: 78px;
  height: 100%;
  position: relative;
  z-index: 10;
  overflow: visible;
  background: var(--chat-rail);
  border-right: 1px solid var(--chat-line);
}

.right-sidebar-inner {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  gap: var(--chat-space-sm);
  padding: 18px 8px 16px;
}

.right-sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  width: 100%;
}

.right-sidebar-user-group {
  margin-top: auto;
  gap: 10px;
}

.right-sidebar-action,
.right-sidebar-user {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  padding: 0;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--chat-muted);
  cursor: pointer;
  position: relative;
  touch-action: manipulation;
  transition:
    background-color var(--dur-2) var(--ease-standard),
    color var(--dur-2) var(--ease-standard),
    transform var(--dur-1) var(--ease-standard);
}

.right-sidebar-action:hover,
.right-sidebar-user:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--chat-ink);
}

.right-sidebar-action:active,
.right-sidebar-user:active {
  transform: scale(0.93);
}

.right-sidebar-action--danger:hover {
  background: var(--chat-danger-soft);
  color: var(--chat-danger);
}

.right-sidebar-action--labeled {
  width: 62px;
  height: auto;
  min-height: 56px;
  padding: 7px 2px 6px;
  gap: 5px;
  flex-direction: column;
  border-radius: var(--radius-md);
}

.right-sidebar-action--admin {
  flex-direction: column;
}

.right-sidebar-action--notification-active {
  color: var(--chat-accent-text);
}

/* 当前项：实心浅底 + 强调色文字，取消左侧竖条 */
.right-sidebar-action--current {
  background: var(--chat-selected);
  color: var(--chat-accent-text);
}

.right-sidebar-action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.right-sidebar-action__label {
  max-width: 100%;
  font-size: 11px;
  line-height: 1.3;
  font-weight: 500;
  letter-spacing: -0.01em;
  white-space: nowrap;
  text-align: center;
}

.right-sidebar-action--settings .right-sidebar-action__label {
  white-space: normal;
}

/* ---------- 提示气泡 ---------- */
.tooltip {
  position: relative;
}

.tooltip::after {
  content: attr(data-tooltip);
  position: absolute;
  left: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%) translateX(-4px);
  padding: 5px 9px;
  border-radius: var(--radius-xs);
  background: rgba(29, 29, 31, 0.92);
  color: #fff;
  font-size: var(--text-xs);
  font-weight: 500;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  z-index: 1000;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
  transition:
    opacity var(--dur-2) var(--ease-standard),
    transform var(--dur-2) var(--ease-standard);
}

.tooltip:hover::after {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
  transition-delay: 500ms;
}

.tooltip:focus-visible::after {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
  transition: none;
}

/* ---------- 会话栏 ---------- */
.left-sidebar {
  flex-shrink: 0;
  width: clamp(304px, 26vw, 368px);
  height: 100%;
  position: relative;
  z-index: 10;
  overflow: hidden;
  background: rgba(246, 246, 248, 0.86);
  border-right: 1px solid var(--chat-line);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  backdrop-filter: blur(24px) saturate(180%);
}

.chat-layout--contacts .left-sidebar {
  display: none;
}

.left-sidebar .sidebar-inner {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--chat-space-sm);
  min-height: 76px;
  padding: 18px 18px 12px 22px;
}

.header-action.mobile-menu-action {
  display: none;
}

.brand-title {
  margin: 0;
  font-family: var(--chat-font-heading);
  font-size: 21px;
  font-weight: 620;
  letter-spacing: -0.03em;
  color: var(--chat-ink);
}

.sidebar-header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.mobile-language-switch {
  display: none;
}

.header-action {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 var(--chat-control);
  width: var(--chat-control);
  height: var(--chat-control);
  padding: 0;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--chat-muted);
  cursor: pointer;
  text-decoration: none;
  transition:
    background-color var(--dur-2) var(--ease-standard),
    color var(--dur-2) var(--ease-standard),
    transform var(--dur-1) var(--ease-standard);
}

.header-action:hover {
  background: rgba(0, 0, 0, 0.055);
  color: var(--chat-ink);
}

.header-action:active {
  transform: scale(0.92);
}

.header-action--primary {
  background: var(--site-action-bg, var(--chat-accent));
  color: var(--site-on-action, #fff);
  box-shadow: 0 2px 8px rgba(var(--site-brand-rgb, 0, 113, 227), 0.24);
}

.header-action--primary:hover {
  background: var(--site-action-hover, var(--chat-accent-hover));
  color: var(--site-on-action, #fff);
}

/* 列表要能收缩（flex:1），其余侧栏区块固定高度；用 :not 避免与列表规则互相覆盖 */
.sidebar-section:not(.sidebar-list) {
  flex-shrink: 0;
}

.sidebar-list-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 6px 24px 10px;
  color: var(--chat-muted);
}

.sidebar-list-heading h2 {
  margin: 0;
  font-family: var(--chat-font);
  font-size: 11px;
  font-weight: 620;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--chat-subtle);
}

.sidebar-list-heading > span {
  font-size: var(--text-2xs);
  font-variant-numeric: tabular-nums;
  color: var(--chat-subtle);
}

/* ---------- 消息区 ---------- */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--chat-paper);
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--chat-space-md);
  min-height: 72px;
  padding: 10px 20px 10px 24px;
  background: rgba(255, 255, 255, 0.78);
  border-bottom: 1px solid var(--chat-line);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  backdrop-filter: blur(24px) saturate(180%);
}

.chat-header__back {
  display: none;
}

.chat-header__avatar {
  flex: 0 0 auto;
}

.chat-header__identity {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
}

.chat-header__identity h2 {
  margin: 0;
  font-family: var(--chat-font-heading);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--chat-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-header__identity span {
  overflow: hidden;
  color: var(--chat-muted);
  font-size: var(--text-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-header__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.chat-header__language-switch {
  width: var(--chat-control);
  min-width: var(--chat-control);
  height: var(--chat-control);
  border: 0;
  background: transparent;
  box-shadow: none;
}

.chat-header__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: var(--chat-control);
  min-height: var(--chat-control);
  padding: 7px 11px;
  border: 1px solid transparent;
  border-radius: var(--chat-radius);
  background: transparent;
  color: var(--chat-muted);
  font-size: var(--text-xs);
  font-weight: 500;
  cursor: pointer;
  touch-action: manipulation;
  white-space: nowrap;
  transition:
    background-color var(--dur-2) var(--ease-standard),
    color var(--dur-2) var(--ease-standard),
    border-color var(--dur-2) var(--ease-standard),
    transform var(--dur-1) var(--ease-standard);
}

.chat-header__button:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--chat-ink);
}

.chat-header__button:active {
  transform: scale(0.95);
}

.chat-header__button--active {
  border-color: rgba(var(--site-brand-rgb, 0, 113, 227), 0.22);
  background: var(--chat-selected);
  color: var(--chat-accent-text);
}

.chat-header__button--danger:hover,
.chat-header__button--blocked {
  border-color: rgba(215, 0, 21, 0.24);
  background: var(--chat-danger-soft);
  color: var(--chat-danger);
}

.chat-header__button:disabled {
  cursor: wait;
  opacity: 0.5;
}

.header-action:focus-visible,
.right-sidebar-action:focus-visible,
.right-sidebar-user:focus-visible,
.chat-header__button:focus-visible,
.chat-header__back:focus-visible,
.load-more-btn:focus-visible,
.empty-start:focus-visible {
  outline: 2px solid rgba(var(--site-brand-rgb, 0, 113, 227), 0.7);
  outline-offset: 2px;
}

/* 连接状态：呼吸点 */
.chat-header__status {
  width: 8px;
  height: 8px;
  margin: 0 4px;
  border-radius: 50%;
  background: var(--lumen-ink-5);
  transition: background-color var(--dur-3) var(--ease-standard);
}

.chat-header__status.online {
  background: var(--chat-online);
  box-shadow: 0 0 0 3px rgba(52, 199, 89, 0.16);
}

/* 通话模式选择 */
.chat-call-controls {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.chat-call-mode {
  height: 30px;
  padding: 0 6px;
  border: 1px solid var(--chat-line);
  border-radius: 8px;
  background: transparent;
  color: var(--chat-muted);
  font-size: var(--text-2xs);
  font-weight: 600;
  cursor: pointer;
}

/* ---------- 消息滚动区 ---------- */
.chat-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 22px max(24px, calc((100% - 920px) / 2));
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  touch-action: pan-y;
}

.load-more-btn {
  display: block;
  margin: 0 auto 18px;
  min-height: 32px;
  padding: 6px 16px;
  border: 1px solid var(--chat-line);
  border-radius: var(--radius-pill);
  background: var(--chat-paper);
  color: var(--chat-muted);
  font-size: var(--text-xs);
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color var(--dur-2) var(--ease-standard),
    border-color var(--dur-2) var(--ease-standard);
}

.load-more-btn:hover {
  background: #fafafc;
  border-color: rgba(0, 0, 0, 0.12);
}

.messages-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 72px 24px;
  color: var(--chat-subtle);
  font-size: var(--text-sm);
}

.messages-refresh-status {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: var(--chat-space-sm);
  padding: 6px 12px;
  color: var(--chat-subtle);
  font-size: var(--text-xs);
}

.messages-refresh-status button {
  min-height: 32px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--chat-accent);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.messages-refresh-status button:hover {
  background: var(--chat-selected);
}

/* ---------- 空态 ---------- */
.chat-empty {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(120% 90% at 50% 0%, rgba(var(--site-brand-rgb, 0, 113, 227), 0.05), transparent 62%);
}

.chat-empty__language-switch {
  position: absolute;
  top: 14px;
  right: 16px;
}

.empty-content {
  display: grid;
  justify-items: center;
  align-items: center;
  gap: 14px;
  max-width: 380px;
  padding: 32px;
  text-align: center;
  animation: empty-in var(--dur-5) var(--ease-out) both;
}

@keyframes empty-in {
  from { opacity: 0; transform: translate3d(0, 16px, 0); }
  to { opacity: 1; transform: none; }
}

.empty-content p {
  margin: 0 0 6px;
  color: var(--chat-muted);
  font-size: var(--text-sm);
  line-height: 1.65;
}

.empty-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 18px;
  color: var(--chat-accent);
  user-select: none;
}

/* 图标外一圈柔和光环，代替插画 */
.empty-brand svg {
  width: 62px;
  height: 62px;
  padding: 15px;
  border-radius: var(--radius-xl);
  background: var(--chat-paper);
  box-shadow:
    var(--shadow-md),
    0 0 0 1px var(--chat-line);
}

.empty-title {
  font-family: var(--chat-font-heading);
  font-size: 27px;
  font-weight: 600;
  letter-spacing: -0.035em;
  color: var(--chat-ink);
}

.empty-start {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 38px;
  padding: 8px 18px;
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--site-action-bg, var(--chat-accent));
  color: var(--site-on-action, #fff);
  font-size: var(--text-sm);
  font-weight: 560;
  box-shadow: 0 4px 14px rgba(var(--site-brand-rgb, 0, 113, 227), 0.22);
  transition:
    transform var(--dur-1) var(--ease-standard),
    box-shadow var(--dur-2) var(--ease-standard);
}

.empty-start:hover {
  box-shadow: 0 8px 22px rgba(var(--site-brand-rgb, 0, 113, 227), 0.3);
}

.empty-start:active {
  transform: scale(0.97);
}

/* ---------- 成员面板 ---------- */
.room-management-layer {
  position: absolute;
  inset: 72px 0 0;
  z-index: 30;
  display: flex;
  justify-content: flex-end;
  background: var(--chat-scrim);
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
  animation: scrim-in var(--dur-3) var(--ease-standard) both;
}

@keyframes scrim-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.room-management-sidebar {
  width: min(360px, 100%);
  height: 100%;
  overflow-y: auto;
  background: var(--chat-paper);
  border-left: 1px solid var(--chat-line);
  touch-action: pan-y;
  box-shadow: var(--chat-shadow-panel);
  animation: panel-in var(--dur-4) var(--ease-out) both;
}

@keyframes panel-in {
  from { transform: translate3d(24px, 0, 0); opacity: 0.4; }
  to { transform: none; opacity: 1; }
}

/* 中等宽度只压缩次要按钮文字，不牺牲标题或触摸面积 */
@media (min-width: 961px) and (max-width: 1280px) {
  .chat-header__button {
    width: var(--chat-control);
    padding: 0;
  }

  .chat-header__button span {
    display: none;
  }
}

@media (max-width: 960px) {
  .chat-layout {
    min-height: 0;
    background: var(--chat-paper);
  }

  .right-sidebar {
    display: none;
  }

  .left-sidebar {
    width: 100%;
    max-width: none;
    border-right: 0;
    background: var(--chat-paper);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }

  .chat-main {
    width: 100%;
    flex: 0 0 100%;
  }

  .chat-layout--mobile-list .chat-main,
  .chat-layout--mobile-chat .left-sidebar {
    display: none;
  }

  .sidebar-header {
    min-height: 60px;
    gap: var(--chat-space-sm);
    padding:
      max(8px, env(safe-area-inset-top))
      max(12px, env(safe-area-inset-right))
      8px
      max(10px, env(safe-area-inset-left));
  }

  .header-action.mobile-menu-action {
    display: flex;
    flex: 0 0 44px;
    width: 44px;
    height: 44px;
  }

  .brand-title {
    flex: 1;
    min-width: 0;
    font-size: 20px;
  }

  .header-action {
    flex-basis: 44px;
    width: 44px;
    height: 44px;
  }

  .sidebar-header-actions {
    gap: 2px;
  }

  .mobile-language-switch {
    display: inline-grid;
  }

  .chat-header {
    min-height: 58px;
    gap: 6px;
    padding:
      max(8px, env(safe-area-inset-top))
      max(10px, env(safe-area-inset-right))
      8px
      max(4px, env(safe-area-inset-left));
  }

  .chat-header__back {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 44px;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--chat-accent);
    touch-action: manipulation;
  }

  .chat-header__back:active {
    background: rgba(0, 0, 0, 0.06);
  }

  .chat-header__avatar {
    flex: 0 0 32px;
  }

  .chat-header__identity h2 {
    font-size: 15px;
  }

  .chat-header__button {
    width: 44px;
    height: 44px;
    min-height: 44px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
  }

  .chat-header__button span {
    display: none;
  }

  .chat-header__status {
    width: 7px;
    height: 7px;
    margin: 0;
  }

  .chat-header__actions {
    gap: 0;
  }

  .chat-header__language-switch {
    width: 44px;
    min-width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: transparent;
  }

  .chat-messages {
    padding: 14px max(10px, env(safe-area-inset-right)) 18px max(10px, env(safe-area-inset-left));
    scrollbar-gutter: auto;
  }

  .room-management-layer {
    position: fixed;
    inset: 0;
    z-index: 40;
    width: auto;
    height: auto;
    padding-left: 40px;
    background: rgba(0, 0, 0, 0.3);
  }

  .room-management-sidebar {
    width: min(360px, 100%);
    height: 100%;
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
}

@media (max-width: 380px) {
  .chat-header__avatar,
  .chat-header__status {
    display: none;
  }

  .chat-header {
    gap: 2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .header-action,
  .right-sidebar-action,
  .right-sidebar-user,
  .tooltip::after,
  .chat-header__button,
  .chat-header__status,
  .empty-content,
  .room-management-layer,
  .room-management-sidebar {
    transition: none;
    animation: none;
  }

  .header-action:active,
  .right-sidebar-action:active,
  .right-sidebar-user:active,
  .chat-header__button:active {
    transform: none;
  }
}
</style>
