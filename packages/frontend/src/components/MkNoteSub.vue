<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="note == null" :class="$style.deleted">
	{{ i18n.ts.deletedNote }}
</div>
<div v-else-if="!muted" :class="[$style.root, { [$style.children]: depth > 1 }]">
	<div :class="$style.main">
		<div v-if="note.channel" :class="$style.colorBar" :style="{ background: note.channel.color }"></div>
		<MkAvatar :class="$style.avatar" :user="note.user" link preview/>
		<div :class="$style.body">
			<MkNoteHeader :class="$style.header" :note="note" :mini="true"/>
			<div>
				<p v-if="note.cw != null" :class="$style.cw">
					<Mfm v-if="note.cw != ''" style="margin-right: 8px;" :text="note.cw" :author="note.user" :nyaize="'respect'"/>
					<MkCwButton v-model="showContent" :text="note.text" :files="note.files" :poll="note.poll"/>
				</p>
				<div v-show="note.cw == null || showContent">
					<MkSubNoteContent :class="$style.text" :note="note"/>
				</div>
			</div>
			<MkReactionsViewer
				v-if="noteActions != null && noteActions.appearNote.reactionAcceptance !== 'likeOnly'"
				style="margin-top: 6px;"
				:reactions="noteActions.$appearNote.reactions"
				:reactionEmojis="noteActions.$appearNote.reactionEmojis"
				:myReaction="noteActions.$appearNote.myReaction"
				:noteId="noteActions.appearNote.id"
			/>
			<footer v-if="noteActions != null">
				<button class="_button" :class="$style.footerButton" @click="noteActions.reply()">
					<i class="ti ti-arrow-back-up"></i>
					<p v-if="noteActions.appearNote.repliesCount > 0" :class="$style.footerButtonCount">{{ number(noteActions.appearNote.repliesCount) }}</p>
				</button>
				<button
					v-if="noteActions.canRenote"
					ref="renoteButton"
					class="_button"
					:class="$style.footerButton"
					@mousedown.prevent="noteActions.renote()"
				>
					<i class="ti ti-repeat"></i>
					<p v-if="noteActions.appearNote.renoteCount > 0" :class="$style.footerButtonCount">{{ number(noteActions.appearNote.renoteCount) }}</p>
				</button>
				<button v-else class="_button" :class="$style.footerButton" disabled>
					<i class="ti ti-ban"></i>
				</button>
				<button ref="reactButton" :class="$style.footerButton" class="_button" @click="noteActions.toggleReact()">
					<i v-if="noteActions.appearNote.reactionAcceptance === 'likeOnly' && noteActions.$appearNote.myReaction != null" class="ti ti-heart-filled" style="color: var(--MI_THEME-love);"></i>
					<i v-else-if="noteActions.$appearNote.myReaction != null" class="ti ti-minus" style="color: var(--MI_THEME-accent);"></i>
					<i v-else-if="noteActions.appearNote.reactionAcceptance === 'likeOnly'" class="ti ti-heart"></i>
					<i v-else class="ti ti-plus"></i>
					<p v-if="(noteActions.appearNote.reactionAcceptance === 'likeOnly' || prefer.s.showReactionsCount) && noteActions.$appearNote.reactionCount > 0" :class="$style.footerButtonCount">{{ number(noteActions.$appearNote.reactionCount) }}</p>
				</button>
				<button v-if="prefer.s.showClipButtonInNoteFooter" ref="clipButton" class="_button" :class="$style.footerButton" @mousedown.prevent="noteActions.clip()">
					<i class="ti ti-paperclip"></i>
				</button>
				<button ref="menuButton" class="_button" :class="$style.footerButton" @mousedown.prevent="noteActions.showMenu()">
					<i class="ti ti-dots"></i>
				</button>
			</footer>
		</div>
	</div>
	<template v-if="depth < 5">
		<MkNoteSub v-for="reply in replies" :key="reply.id" :note="reply" :class="$style.reply" :detail="true" :depth="depth + 1"/>
	</template>
	<div v-else :class="$style.more">
		<MkA class="_link" :to="notePage(note)">{{ i18n.ts.continueThread }} <i class="ti ti-chevron-double-right"></i></MkA>
	</div>
</div>
<div v-else :class="$style.muted" @click="muted = false">
	<I18n :src="i18n.ts.userSaysSomething" tag="small">
		<template #name>
			<MkA v-user-preview="note.userId" :to="userPage(note.user)">
				<MkUserName :user="note.user"/>
			</MkA>
		</template>
	</I18n>
</div>
</template>

<script lang="ts" setup>
import { ref, useTemplateRef } from 'vue';
import * as Misskey from 'misskey-js';
import { notePage } from '@@/js/note.js';
import { userPage } from '@@/js/user.js';
import MkNoteHeader from '@/components/MkNoteHeader.vue';
import MkSubNoteContent from '@/components/MkSubNoteContent.vue';
import MkCwButton from '@/components/MkCwButton.vue';
import MkReactionsViewer from '@/components/MkReactionsViewer.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/i.js';
import { checkWordMute } from '@/utility/check-word-mute.js';
import { useNote } from '@/composables/use-note.js';
import { prefer } from '@/preferences.js';
import number from '@/filters/number.js';

const props = withDefaults(defineProps<{
	note: Misskey.entities.Note | null;
	detail?: boolean;

	// how many notes are in between this one and the note being viewed in detail
	depth?: number;
}>(), {
	depth: 1,
});

const muted = ref(props.note && $i ? checkWordMute(props.note, $i, $i.mutedWords) : false);

const showContent = ref(false);
const replies = ref<Misskey.entities.Note[]>([]);

// Template Refsの定義
const menuButton = useTemplateRef('menuButton');
const renoteButton = useTemplateRef('renoteButton');
const reactButton = useTemplateRef('reactButton');
const clipButton = useTemplateRef('clipButton');

// detail指定時(ノート詳細ページの返信として表示される場合)はリアクションの表示・操作ボタンも有効にする
const noteActions = props.detail && props.note != null
	? useNote({ note: props.note }, {
		menuButton,
		renoteButton,
		reactButton,
		clipButton,
	})
	: null;

if (props.detail && props.note) {
	misskeyApi('notes/children', {
		noteId: props.note.id,
		limit: 5,
	}).then(res => {
		replies.value = res;
	});
}
</script>

<style lang="scss" module>
.root {
	padding: 16px 32px;
	font-size: 0.9em;
	position: relative;

	&.children {
		padding: 10px 0 0 16px;
		font-size: 1em;
	}
}

.main {
	display: flex;
}

.colorBar {
	position: absolute;
	top: 8px;
	left: 8px;
	width: 5px;
	height: calc(100% - 8px);
	border-radius: 999px;
	pointer-events: none;
}

.avatar {
	flex-shrink: 0;
	display: block;
	margin: 0 8px 0 0;
	width: 38px;
	height: 38px;
	border-radius: 8px;
}

.body {
	flex: 1;
	min-width: 0;
}

.header {
	margin-bottom: 2px;
}

.cw {
	cursor: default;
	display: block;
	margin: 0;
	padding: 0;
	overflow-wrap: break-word;
}

.text {
	margin: 0;
	padding: 0;
}

.footerButton {
	margin: 0;
	padding: 8px;
	color: color-mix(in srgb, var(--MI_THEME-panel), var(--MI_THEME-fg) 70%); // opacityなど不透明度で表現するとレンダリングパフォーマンスに影響するので通常の色の混合で代用

	&:not(:last-child) {
		margin-right: 16px;
	}

	&:hover {
		color: var(--MI_THEME-fgHighlighted);
	}
}

.footerButtonCount {
	display: inline;
	margin: 0 0 0 8px;
}

.reply, .more {
	border-left: solid 0.5px var(--MI_THEME-divider);
	margin-top: 10px;
}

.more {
	padding: 10px 0 0 16px;
}

@container (max-width: 450px) {
	.root {
		padding: 14px 16px;

		&.children {
			padding: 10px 0 0 8px;
		}
	}
}

.muted {
	text-align: center;
	padding: 8px !important;
	border: 1px solid var(--MI_THEME-divider);
	margin: 8px 8px 0 8px;
	border-radius: 8px;
}

.deleted {
	text-align: center;
	padding: 8px !important;
	margin: 8px 8px 0 8px;
	--color: light-dark(rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.15));
	background-size: auto auto;
	background-image: repeating-linear-gradient(135deg, transparent, transparent 10px, var(--color) 4px, var(--color) 14px);
	border-radius: 8px;
}
</style>
