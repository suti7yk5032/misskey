<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkContainer :showHeader="widgetProps.showHeader" :style="`height: ${widgetProps.height}px;`" :scrollable="true" class="mkw-recall">
	<template #icon>
		<i class="ti ti-clock-hour-2"></i>
	</template>
	<template #header>
		<span>{{ headerTitle }}</span>
		<i v-if="widgetProps.syncTime" class="ti ti-refresh" style="margin-left: 6px; opacity: 0.7;" :title="i18n.ts.recallSyncTime"/>
	</template>
	<div v-if="paginatorForNotes">
		<MkNotesTimeline :key="tlKey" :paginator="paginatorForNotes" :withControl="false"/>
	</div>
	<div v-else :class="$style.empty">
		<i class="ti ti-dots"></i>
	</div>
</MkContainer>
</template>

<script lang="ts" setup>
import { ref, shallowRef, markRaw, computed, watch, onMounted } from 'vue';
import * as Misskey from 'misskey-js';
import { lang } from '@@/js/config.js';
import { useWidgetPropsManager } from './widget.js';
import type { WidgetComponentEmits, WidgetComponentExpose, WidgetComponentProps } from './widget.js';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';
import MkContainer from '@/components/MkContainer.vue';
import MkNotesTimeline from '@/components/MkNotesTimeline.vue';
import { Paginator } from '@/utility/paginator.js';
import { i18n } from '@/i18n.js';

const name = 'recall';

const widgetPropsDef = {
	showHeader: {
		type: 'boolean',
		default: true,
	},
	height: {
		type: 'number',
		default: 500,
	},
	limit: {
		type: 'number',
		default: 50,
	},
	listId: {
		type: 'string',
		default: '',
	},
	syncTime: {
		type: 'boolean',
		default: true,
	},
	fixedOneYear: {
		type: 'boolean',
		default: false,
	},
} satisfies FormWithDefault;

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;

const props = defineProps<WidgetComponentProps<WidgetProps>>();
const emit = defineEmits<WidgetComponentEmits<WidgetProps>>();

const { widgetProps, configure, save } = useWidgetPropsManager(name, widgetPropsDef, props, emit);
const widgetId = computed(() => props.widget ? props.widget.id : null);

const paginatorForNotes = shallowRef<Paginator<'notes/timeline' | 'notes/user-list-timeline'> | null>(null);
const tlKey = ref('');
const selectedDate = ref<Date | null>(null);
const firstNoteDate = ref<Date | null>(null);

const today = new Date();
today.setHours(0, 0, 0, 0);

const daysBetween = computed(() => {
	if (!firstNoteDate.value) return 0;
	return Math.floor((today.valueOf() - firstNoteDate.value.valueOf()) / 86400000);
});

const pickRandomDate = () => {
	if (!firstNoteDate.value) return new Date();
	const offset = Math.floor(Math.random() * (daysBetween.value + 1));
	const d = new Date(firstNoteDate.value);
	d.setDate(d.getDate() + offset);
	return d;
};

const load = () => {
	if (!firstNoteDate.value) return; // 初期化前は何もしない
	if (widgetProps.fixedOneYear) {
		// 今日と同じ月日で1年前（存在しない場合/サーバー未満は最初のノート日をフォールバック）
		const now = new Date();
		const oneYearAgo = new Date(now);
		oneYearAgo.setFullYear(now.getFullYear() - 1);
		oneYearAgo.setHours(0, 0, 0, 0);
		// サーバー稼働期間が1年未満なら firstNoteDate を使用
		selectedDate.value = (firstNoteDate.value.valueOf() > oneYearAgo.valueOf()) ? new Date(firstNoteDate.value) : oneYearAgo;
	} else {
		selectedDate.value = pickRandomDate();
		selectedDate.value.setHours(0, 0, 0, 0);
	}
	const sinceDate = selectedDate.value.valueOf();
	const now = new Date();
	const untilDate = widgetProps.syncTime
		? new Date(selectedDate.value.getFullYear(), selectedDate.value.getMonth(), selectedDate.value.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), 0).valueOf()
		: new Date(selectedDate.value.getFullYear(), selectedDate.value.getMonth(), selectedDate.value.getDate(), 23, 59, 59, 999).valueOf();
	const endpoint: 'notes/timeline' | 'notes/user-list-timeline' = widgetProps.listId ? 'notes/user-list-timeline' : 'notes/timeline';
	type TimelineParams = {
		sinceDate: number;
		untilDate: number;
		includeLocalRenotes: boolean;
		includeMyRenotes: boolean;
		includeRenotedMyNotes: boolean;
		listId?: string;
	};
	const params: TimelineParams = {
		sinceDate,
		untilDate,
		includeLocalRenotes: false,
		includeMyRenotes: false,
		includeRenotedMyNotes: false,
	};
	if (endpoint === 'notes/user-list-timeline') params.listId = widgetProps.listId;
	paginatorForNotes.value = markRaw(new Paginator(endpoint, {
		limit: widgetProps.limit,
		params,
	}));
	tlKey.value = `${endpoint}-${sinceDate}-${untilDate}`;
};

onMounted(async () => {
	try {
		const api = await import('@/utility/misskey-api.js');
		const notes: Misskey.entities.Note[] = await api.misskeyApi('notes', { local: true, limit: 1, sinceDate: 1 });
		firstNoteDate.value = notes[0] ? new Date(notes[0].createdAt) : new Date();
		firstNoteDate.value.setHours(0, 0, 0, 0);
	} catch (err) {
		firstNoteDate.value = new Date();
		firstNoteDate.value.setHours(0, 0, 0, 0);
	}
	load();
});

watch(() => widgetProps.limit, () => load());
watch(() => widgetProps.syncTime, () => load());
watch(() => widgetProps.fixedOneYear, () => load());
watch(() => widgetProps.listId, () => load());

const headerTitle = computed(() => {
	if (!selectedDate.value) return i18n.ts.recall;
	const dateStr = selectedDate.value.toLocaleDateString(lang, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
	return widgetProps.fixedOneYear
		? `${i18n.ts.recall} • 1y / ${dateStr}`
		: `${i18n.ts.recall} / ${dateStr}`;
});

// expose for settings
defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: widgetId.value,
});
</script>

<style lang="scss" module>
.empty {
	text-align: center;
	padding: 8px;
	opacity: 0.6;
	font-size: 0.9em;
}
</style>
