<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader v-model:tab="tab" :actions="headerActions" :tabs="headerTabs" :swipable="true">
	<div v-if="tab === 'reactions'">
		<XReactions/>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import XReactions from '@/pages/research.reactions.vue';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';

const props = withDefaults(defineProps<{
	initialTab?: string;
}>(), {
	initialTab: 'reactions',
});

const tab = ref(props.initialTab);

const headerActions = computed(() => []);

const tabs = [{
	key: 'reactions',
	icon: 'ti ti-mood-happy',
	title: i18n.ts.reactions,
}];

const headerTabs = computed(() => tabs);

definePage(() => ({
	title: i18n.ts.research,
	icon: 'ti ti-flask',
}));
</script>
