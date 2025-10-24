<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_spacer" style="--MI_SPACER-w: 800px;">
	<div style="margin-bottom: var(--MI-margin);">
		<p :class="$style.rangeLabel">{{ i18n.ts.recallDays }} | {{ str_sinceDate }}</p>
		<div :class="$style.inputForm">
			<button :class="$style.rangeButton" :disabled="days_ago <= 0" @click="decrementDay"><i class="ti ti-caret-left"></i></button>
			<MkRange v-model="days_ago" style="flex-grow: 1; margin-left: var(--MI-margin);" :min="0" :max="days_between" :step="1" easing :textConverter="(v) => (days_between - v) === 0 ? `今日` : `${days_between - v} 日前`"></MkRange>
			<button :class="$style.rangeButton" style="margin-left: var(--MI-margin);" :disabled="days_ago >= days_between" @click="incrementDay"><i class="ti ti-caret-right"></i></button>
		</div>
	</div>
	<MkFoldableSection style="margin-bottom: var(--MI-margin);" :expanded="true">
		<template #header>{{ i18n.ts.options }}</template>
		<MkSwitch v-model="sync_time" click="">
			<template #label>{{ i18n.ts.recallSyncTime }}</template>
		</MkSwitch>
	</MkFoldableSection>
	<div v-if="paginatorForNotes">
		<MkNotesTimeline :key="tl_key" :paginator="paginatorForNotes" :withControl="false"/>
	</div>
</div>
</template>

<script lang="ts" setup>
import { markRaw, shallowRef, ref, watch } from 'vue';
import { lang } from '@@/js/config.js';
import MkNotesTimeline from '@/components/MkNotesTimeline.vue';
import { i18n } from '@/i18n.js';
import { Paginator } from '@/utility/paginator.js';
import MkRange from '@/components/MkRange.vue';
import MkFoldableSection from '@/components/MkFoldableSection.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import { misskeyApi } from '@/utility/misskey-api.js';

const dateSubtractDays = (src_date: Date, days: number, hours: Array<number>) => {
	const result = src_date;
	result.setDate(result.getDate() - days);
	result.setHours(hours[0], hours[1], hours[2], hours[3]);
	return result;
};

let sync_time = ref(false);

const tl_key = ref(0);
const paginatorForNotes = shallowRef<Paginator<'notes/timeline'> | null>(null);

const first_note = await misskeyApi('notes', {
	local: true,
	limit: 1,
	sinceDate: 1,
});

const first_note_date = first_note[0] ? new Date(first_note[0].createdAt) : new Date();
const days_between = (dateSubtractDays(new Date(), 0, [0, 0, 0, 0]).valueOf() - dateSubtractDays(first_note_date, 0, [0, 0, 0, 0]).valueOf()) / 86400000;
let days_ago = ref(days_between < 365 ? 0 : days_between - 365);

const getSinceDate = () => {
	const days_ago_fix = days_between - days_ago.value;
	return dateSubtractDays(new Date(), days_ago_fix, [0, 0, 0, 0]);
};

const getStrSinceDate = () => {
	return getSinceDate().toLocaleDateString(lang, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const loadNotes = () => {
	str_sinceDate = getStrSinceDate();
	const today = new Date();
	const untilTime = sync_time.value ? [today.getHours(), today.getMinutes(), today.getSeconds(), 0] : [23, 59, 59, 999];
	paginatorForNotes.value = markRaw(new Paginator('notes/timeline', {
		limit: 10,
		params: {
			sinceDate: getSinceDate().valueOf(),
			untilDate: dateSubtractDays(getSinceDate(), 0, untilTime).valueOf(),
			includeLocalRenotes: false,
			includeMyRenotes: false,
			includeRenotedMyNotes: false,
		},
	}));
	tl_key.value++;
};

const decrementDay = () => {
	if (days_ago.value > 0) days_ago.value--;
};
const incrementDay = () => {
	if (days_ago.value < days_between) days_ago.value++;
};

let str_sinceDate = getStrSinceDate();

loadNotes();

watch(days_ago, () => {
	loadNotes();
});

watch(sync_time, () => {
	loadNotes();
});

</script>

<style lang="scss" module>
.inputForm {
  display: flex;
  justify-content: flex-start;
}

.rangeLabel {
	font-size: 0.8em;
	margin-bottom: 0.5em;
	margin-top: 0;
}

.rangeButton {
	background: none;
	border: none;
}
</style>
