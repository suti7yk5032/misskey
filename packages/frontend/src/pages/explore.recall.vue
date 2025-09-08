<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_spacer" style="--MI_SPACER-w: 800px;">
	<MkNotesTimeline :paginator="paginatorForNotes"/>
</div>
</template>

<script lang="ts" setup>
import { markRaw } from 'vue';
import MkNotesTimeline from '@/components/MkNotesTimeline.vue';
// import { i18n } from '@/i18n.js';
import { Paginator } from '@/utility/paginator.js';

const dateSubtractDays = (src_date: Date, days: number, hours: Array<number>) => {
	const result = src_date;
	result.setDate(result.getDate() - days);
	result.setHours(hours[0], hours[1], hours[2], hours[3]);
	return result;
};

const paginatorForNotes = markRaw(new Paginator('notes', {
	limit: 10,
	params: {
		untilDate: dateSubtractDays(new Date(Date.now()), 365, [23, 59, 59, 999]).valueOf(),
		sinceDate: dateSubtractDays(new Date(Date.now()), 365, [0, 0, 0, 0]).valueOf(),
	},
}));

</script>
