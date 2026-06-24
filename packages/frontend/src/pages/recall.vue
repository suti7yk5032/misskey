<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader>
	<div class="_spacer" style="--MI_SPACER-w: 800px;">
		<div style="margin-bottom: var(--MI-margin);">
			<div :class="$style.calenderForm">
				<div style="margin-right: auto;">
					<MkButton v-tooltip="i18n.ts.jumpToSpecifiedDate" iconOnly transparent rounded @click="selectDay"><i class="ti ti-calendar"></i> {{ i18n.ts.recallDays }} | {{ strSinceDate }}</MkButton>
				</div>
				<div>
					<MkButton v-tooltip="i18n.ts.random" iconOnly transparent rounded @click="shuffleDay"><i class="ti ti-arrows-shuffle"></i></MkButton>
				</div>
			</div>
			<div :class="$style.inputForm">
				<MkButton v-tooltip="i18n.ts.firstDay" :active="daysOffset > 0" iconOnly transparent rounded @click="setDaysOffset(daysSinceFirstNote)"><i class="ti ti-player-skip-back"></i></MkButton>
				<MkButton v-tooltip="i18n.ts.previousDay" :active="daysOffset > 0" iconOnly transparent rounded @click="decrementDay"><i class="ti ti-player-track-prev"></i></MkButton>
				<MkRange v-model="daysOffset" style="flex-grow: 1;" :min="0" :max="daysSinceFirstNote" :step="1" easing :textConverter="(v) => (daysSinceFirstNote - v) === 0 ? `${i18n.ts.today}` : `${i18n.tsx._ago.daysAgo({ n: daysSinceFirstNote - v })}`"></MkRange>
				<MkButton v-tooltip="i18n.ts.nextDay" :active="daysOffset < daysSinceFirstNote" iconOnly transparent rounded @click="incrementDay"><i class="ti ti-player-track-next"></i></MkButton>
				<MkButton v-tooltip="i18n.ts.today" :active="daysOffset < daysSinceFirstNote" iconOnly transparent rounded @click="setDaysOffset(0)"><i class="ti ti-player-skip-forward"></i></MkButton>
			</div>
			<div>
				<div :class="$style.miscFormLeft">
					<MkButton iconOnly transparent rounded @click="reverseNumberSubtractUnit"><i class="ti ti-arrows-exchange-2"></i></MkButton>
					<MkButton iconOnly transparent rounded @click="decrementNumberSubtractUnit"><i class="ti ti-caret-down"></i></MkButton>
					<MkButton :class="$style.subtractButton" @click="setDateByYears(numberSubtractUnit)">{{ getYearsLabel(numberSubtractUnit) }}</MkButton>
					<MkButton :class="$style.subtractButton" @click="setDateByMonths(numberSubtractUnit)">{{ getMonthsLabel(numberSubtractUnit) }}</MkButton>
					<MkButton :class="$style.subtractButton" @click="setDateByWeeks(numberSubtractUnit)">{{ getWeeksLabel(numberSubtractUnit) }}</MkButton>
					<MkButton iconOnly transparent rounded @click="incrementNumberSubtractUnit"><i class="ti ti-caret-up"></i></MkButton>
				</div>
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
</PageWithHeader>
</template>

<script lang="ts" setup>
import { markRaw, shallowRef, ref, watch } from 'vue';
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
import MkButton from '@/components/MkButton.vue';
import { definePage } from '@/page.js';

const convertMsToDays = (ms: number) => {
	return Math.floor(ms / 86400000);
};

const subtractDays = (date: Date, days: number, time?: Array<number>) => {
	const d = new Date(date);
	const t = time ?? [0, 0, 0, 0];
	d.setDate(d.getDate() - days);
	d.setHours(t[0], t[1], t[2], t[3]);
	return d;
};

const pickRandomDays = (days: number) => {
	return Math.floor(days * Math.random());
};

const getStrSinceDate = (date: Date) => {
	return date.toLocaleDateString(lang, {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
};

const today = new Date();
const firstNote = await misskeyApi('notes', { local: true, limit: 1, sinceDate: 1 });
const firstNoteDate = firstNote[0] ? new Date(firstNote[0].createdAt) : new Date();

const sinceDate = ref(new Date());
const untilDate = ref(new Date());

// 最初のノートから何日経ったかの日数
const daysSinceFirstNote = firstNote[0] ? convertMsToDays(subtractDays(today, 0, [0, 0, 0, 0]).valueOf() - subtractDays(firstNoteDate, 0, [0, 0, 0, 0]).valueOf()) : 0;
// 今日から何日を引くかの日数
const daysAgo = ref(0);
if (daysSinceFirstNote > 365) {
	daysAgo.value = 365;
} else {
	daysAgo.value = daysSinceFirstNote;
}
// 最初のノートから何日経ったかの日数 (スライダー用)
const daysOffset = ref(daysSinceFirstNote - daysAgo.value);
// ショートカットボタン用
const numberSubtractUnit = ref(1);
const isReverseNumberSubtractUnit = ref(false);

const getYearsLabel = (years: number) => {
	return isReverseNumberSubtractUnit.value
		? i18n.tsx._timeIn.years({ n: years.toString() })
		: i18n.tsx._ago.yearsAgo({ n: years.toString() });
};

const getMonthsLabel = (months: number) => {
	return isReverseNumberSubtractUnit.value
		? i18n.tsx._timeIn.months({ n: months.toString() })
		: i18n.tsx._ago.monthsAgo({ n: months.toString() });
};

const getWeeksLabel = (weeks: number) => {
	return isReverseNumberSubtractUnit.value
		? i18n.tsx._timeIn.weeks({ n: weeks.toString() })
		: i18n.tsx._ago.weeksAgo({ n: weeks.toString() });
};

const tlKey = ref(0);
const syncTime = ref(false);
const listId = ref('');

const strSinceDate = ref('');
const userLists = ref([{ label: i18n.ts.none, value: '' }]);
const paginatorForNotes = shallowRef<Paginator<'notes/timeline' | 'notes/user-list-timeline'> | null>(null);

const setDate = (date: Date) => {
	sinceDate.value = subtractDays(date, 0, [0, 0, 0, 0]);
	untilDate.value = syncTime.value ? subtractDays(date, 0, [today.getHours(), today.getMinutes(), today.getSeconds(), 999]) : subtractDays(date, 0, [23, 59, 59, 999]);
};

const setDaysOffset = (days: number) => {
	if (days > daysSinceFirstNote) {
		daysOffset.value = 0;
	} else if (days < 0) {
		daysOffset.value = daysSinceFirstNote;
	} else {
		daysOffset.value = daysSinceFirstNote - days;
	}
};

const setDateByWeeks = (weeks: number) => {
	const date = new Date(sinceDate.value);
	const direction = isReverseNumberSubtractUnit.value ? 1 : -1;
	date.setDate(date.getDate() + (weeks * 7 * direction));
	const days = convertMsToDays(subtractDays(today, 0, [0, 0, 0, 0]).valueOf() - subtractDays(date, 0, [0, 0, 0, 0]).valueOf());
	setDaysOffset(days);
};

const setDateByMonths = (months: number) => {
	const date = new Date(sinceDate.value);
	const direction = isReverseNumberSubtractUnit.value ? 1 : -1;
	date.setMonth(date.getMonth() + (months * direction));
	const days = convertMsToDays(subtractDays(today, 0, [0, 0, 0, 0]).valueOf() - subtractDays(date, 0, [0, 0, 0, 0]).valueOf());
	setDaysOffset(days);
};

const setDateByYears = (years: number) => {
	const date = new Date(sinceDate.value);
	const direction = isReverseNumberSubtractUnit.value ? 1 : -1;
	date.setFullYear(date.getFullYear() + (years * direction));
	const days = convertMsToDays(subtractDays(today, 0, [0, 0, 0, 0]).valueOf() - subtractDays(date, 0, [0, 0, 0, 0]).valueOf());
	setDaysOffset(days);
};

const reverseNumberSubtractUnit = () => {
	if (isReverseNumberSubtractUnit.value) {
		isReverseNumberSubtractUnit.value = false;
	} else {
		isReverseNumberSubtractUnit.value = true;
	}
};

const shuffleDay = () => {
	setDaysOffset(pickRandomDays(daysSinceFirstNote));
};

const decrementDay = () => {
	if (daysOffset.value <= 0) return;
	setDaysOffset(daysSinceFirstNote - (daysOffset.value - 1));
};

const incrementDay = () => {
	if (daysOffset.value >= daysSinceFirstNote) return;
	setDaysOffset(daysSinceFirstNote - (daysOffset.value + 1));
};

const decrementNumberSubtractUnit = () => {
	if (numberSubtractUnit.value <= 1) return;
	numberSubtractUnit.value--;
};

const incrementNumberSubtractUnit = () => {
	numberSubtractUnit.value++;
};

const load = () => {
	strSinceDate.value = getStrSinceDate(sinceDate.value);

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
		sinceDate: sinceDate.value.valueOf(),
		untilDate: untilDate.value.valueOf(),
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

async function selectDay() {
	const { canceled, result } = await os.inputDate({
		title: i18n.ts.inputDatetime,
		default: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
	});
	if (canceled) return;
	const selectedDate = new Date(`${result}T00:00:00`);
	if (selectedDate.valueOf() - firstNoteDate.valueOf() < 0) {
		daysOffset.value = 0;
	} else if (selectedDate.valueOf() - firstNoteDate.valueOf() > today.valueOf() - firstNoteDate.valueOf()) {
		daysOffset.value = daysSinceFirstNote;
	} else {
		daysOffset.value = daysSinceFirstNote - convertMsToDays(subtractDays(today, 0, [0, 0, 0, 0]).valueOf() - subtractDays(selectedDate, 0, [0, 0, 0, 0]).valueOf());
	}
}

definePage(() => ({
	title: i18n.ts.recall,
	icon: 'ti ti-clock-hour-2',
}));

fetchUserLists();
setDate(subtractDays(today, daysAgo.value));
load();

watch(daysOffset, () => {
	daysAgo.value = daysSinceFirstNote - daysOffset.value;
	setDate(subtractDays(today, daysAgo.value));
	load();
});

watch(syncTime, () => {
	setDate(sinceDate.value);
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
  align-items: center;
	gap: 10px;
	margin-bottom: 0.5em;
}

.subtractButton {
	@media (max-width: 600px) {
		min-width: 12px;
		padding-left: 8px;
		padding-right: 8px;
	}
}

.miscFormLeft {
	display: flex;
	flex-wrap: wrap;
	align-items: flex-start;
	gap: 10px;
	min-width: 0;
}

.calenderForm {
	display: flex;
	gap: 10px;
	align-items: start;
}
</style>
