<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_spacer" style="--MI_SPACER-w: 800px;">
	<label style="margin-bottom: var(--MI-margin);">{{ i18n.ts.recallDays }}</label>
	<div :class="$style.inputForm" style="margin-bottom: var(--MI-margin);">
		<MkInput v-model="days_ago" style="flex-grow: 1;" type="number"/>
		<MkButton style="margin-left: var(--MI-margin);" @click="loadNotes()">{{ i18n.ts.reload }}</MkButton>
	</div>
	<div v-if="paginatorForNotes">
		<MkNotesTimeline :key="tl_key" :paginator="paginatorForNotes"/>
	</div>
</div>
</template>

<script lang="ts" setup>
import { markRaw, shallowRef, ref } from 'vue';
import MkNotesTimeline from '@/components/MkNotesTimeline.vue';
import { i18n } from '@/i18n.js';
import { Paginator } from '@/utility/paginator.js';
import MkInput from '@/components/MkInput.vue';
import MkButton from '@/components/MkButton.vue';

const dateSubtractDays = (src_date: Date, days: number, hours: Array<number>) => {
	const result = src_date;
	result.setDate(result.getDate() - days);
	result.setHours(hours[0], hours[1], hours[2], hours[3]);
	return result;
};

let days_ago = 365;

const tl_key = ref(0);
const paginatorForNotes = shallowRef<Paginator<'notes/hybrid-timeline'> | null>(null);

const loadNotes = () => {
	paginatorForNotes.value = markRaw(new Paginator('notes/hybrid-timeline', {
		limit: 10,
		params: {
			sinceDate: dateSubtractDays(new Date(), days_ago, [0, 0, 0, 0]).valueOf(),
			untilDate: dateSubtractDays(new Date(), days_ago - 1, [0, 0, 0, 0]).valueOf(),
			includeLocalRenotes: false,
			includeMyRenotes: false,
			includeRenotedMyNotes: false,
		},
	}));
	tl_key.value++;
};

loadNotes();

</script>

<style land="scss" module>
.inputForm {
	display: flex;
	justify-content: flex-start;
}
</style>
