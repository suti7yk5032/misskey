<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_spacer" style="--MI_SPACER-w: 800px;">
	<div style="margin-bottom: var(--MI-margin);">
		<p :class="$style.rangeLabel">{{ i18n.ts.recallDays }} | {{ strSinceDate }}</p>
		<div :class="$style.inputForm">
			<button :class="$style.rangeButton" :disabled="daysOffset <= 0" @click="decrementDay"><i class="ti ti-caret-left"></i></button>
			<MkRange v-model="daysOffset" style="flex-grow: 1; margin-left: var(--MI-margin);" :min="0" :max="daysMax" :step="1" easing :textConverter="(v) => (daysMax - v) === 0 ? `${i18n.ts.today}` : `${i18n.tsx._ago.daysAgo({ n: daysMax - v })}`"></MkRange>
			<button :class="$style.rangeButton" style="margin-left: var(--MI-margin);" :disabled="daysOffset >= daysMax" @click="incrementDay"><i class="ti ti-caret-right"></i></button>
			<button :class="$style.rangeButton" style="margin-left: var(--MI-margin);" @click="shuffleDay"><i class="ti ti-arrows-shuffle"></i></button>
		</div>
	</div>
	<MkFoldableSection style="margin-bottom: var(--MI-margin);" :expanded="false">
		<template #header>{{ i18n.ts.options }}</template>
		<MkSwitch v-model="syncTime" click="">
			<template #label>{{ i18n.ts.recallSyncTime }}</template>
		</MkSwitch>
		<MkSelect v-model="listId" style="margin-top: var(--MI-margin);" :items="userLists">
			<template #label>{{ i18n.ts.lists }}</template>
		</MkSelect>
	</MkFoldableSection>
	<div v-if="paginatorForNotes">
		<MkNotesTimeline :key="tlKey" :paginator="paginatorForNotes" :withControl="false"/>
	</div>
</div>
</template>

<script lang="ts" setup>
import { markRaw, shallowRef, ref, watch, onMounted } from 'vue';
import { lang } from '@@/js/config.js';
import MkNotesTimeline from '@/components/MkNotesTimeline.vue';
import { i18n } from '@/i18n.js';
import { Paginator } from '@/utility/paginator.js';
import MkRange from '@/components/MkRange.vue';
import MkFoldableSection from '@/components/MkFoldableSection.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import * as os from '@/os.js';

const convertMsToDays = (ms: number) => {
	return Math.floor(ms / 86400000);
};

const dateSubtractDays = (date: Date, days: number, time: Array<number> | null = null) => {
	const d = new Date(date);
	const t = time ?? [0, 0, 0, 0];
	d.setDate(d.getDate() - days);
	d.setHours(t[0], t[1], t[2], t[3]);
	return d;
};

const firstNote = await misskeyApi('notes', { local: true, limit: 1, sinceDate: 1 });
const localTimeOffset = new Date(firstNote[0].createdAt).getTimezoneOffset() * 60 * 1000 * -1;
const tlKey = ref(0);
const syncTime = ref(false);
const listId = ref<string>('');
const paginatorForNotes = shallowRef<Paginator<'notes/timeline' | 'notes/user-list-timeline'> | null>(null);
const daysOffset = ref(0);
const today = new Date();

const daysMax = ref(firstNote[0] ? convertMsToDays(dateSubtractDays(today, 0, [0, 0, 0, 0]).valueOf() - dateSubtractDays(new Date(firstNote[0].createdAt), 0, [0, 0, 0, 0]).valueOf() + localTimeOffset) : 0);
const strSinceDate = ref('');
const userLists = ref<Array<{ label: string; value: string }>>([{ label: i18n.ts.none, value: '' }]);

const pickRandomOffsetDays = () => {
	return Math.floor(Math.random() * daysMax.value);
};

const shuffleDay = () => {
	daysOffset.value = pickRandomOffsetDays();
};

const decrementDay = () => {
	if (daysOffset.value <= 0) return;
	daysOffset.value--;
};

const incrementDay = () => {
	if (daysOffset.value >= daysMax.value) return;
	daysOffset.value++;
};

const getStrSinceDate = (daysAgo?: number) => {
	const dateAgo = daysAgo !== undefined ? dateSubtractDays(today, daysAgo) : dateSubtractDays(today, 0);
	return dateAgo.toLocaleDateString(lang, {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
};

const load = () => {
	const daysAgo = daysMax.value - daysOffset.value;
	strSinceDate.value = getStrSinceDate(daysAgo);
	const sinceDate = dateSubtractDays(today, daysAgo, [0, 0, 0, 0]).valueOf();
	const untilDate = syncTime.value ? dateSubtractDays(today, daysAgo, [today.getHours(), today.getMinutes(), today.getSeconds(), 999]).valueOf() : dateSubtractDays(today, daysAgo, [23, 59, 59, 999]).valueOf();
	const endpoint: 'notes/timeline' | 'notes/user-list-timeline' = listId.value ? 'notes/user-list-timeline' : 'notes/timeline';
	type TimelineParams = {
		sinceDate: number;
		untilDate: number;
		includeLocalRenotes: boolean;
		includeMyRenotes: boolean;
		includeRenotedMyNotes: boolean;
		listId?: string;
	};
	const params: TimelineParams = {
		sinceDate: sinceDate,
		untilDate: untilDate,
		includeLocalRenotes: false,
		includeMyRenotes: false,
		includeRenotedMyNotes: false,
	};
	if (endpoint === 'notes/user-list-timeline') params.listId = listId.value;
	paginatorForNotes.value = markRaw(new Paginator(endpoint, {
		limit: 10,
		params,
	}));
	tlKey.value++;
};

const inputCustomUserListID = () => {
	os.inputText({
		title: i18n.ts.inputCustomUserListID,
		default: '',
	}).then(({ canceled, result: customListId }) => {
		if (canceled) return;
		listId.value = customListId;
	});
};

const fetchUserLists = async () => {
	try {
		const lists = await misskeyApi('users/lists/list');
		lists.forEach(element => {
			userLists.value.push({ label: element.name, value: element.id });
		});
	} catch (err) {
		console.error('Failed to fetch user lists:', err);
	}
	userLists.value.push({ label: i18n.ts.inputCustomUserListID, value: 'inputCustomUserListID' });
};

const firstNoteDate = firstNote[0] ? new Date(firstNote[0].createdAt) : new Date();
if (convertMsToDays(today.valueOf() - firstNoteDate.valueOf()) >= 365) {
	daysOffset.value = convertMsToDays(today.valueOf() - firstNoteDate.valueOf()) - 365;
} else {
	daysOffset.value = 0;
}

fetchUserLists();
load();

watch(daysOffset, () => {
	load();
});

watch(syncTime, () => {
	load();
});

watch(listId, () => {
	if (listId.value === 'inputCustomUserListID') inputCustomUserListID();
	load();
});

</script>

<style lang="scss" module>
.inputForm {
  display: flex;
  justify-content: flex-start;
}

.rangeLabel {
	font-size: 0.85em;
	margin-bottom: 0.5em;
	margin-top: 0;
}

.rangeButton {
	background: none;
	border: none;
}

.selectLabel {
	display: block;
	font-size: 0.9em;
	font-weight: 600;
	margin-bottom: 0.5em;
}
</style>
