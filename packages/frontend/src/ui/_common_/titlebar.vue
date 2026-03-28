<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="[$style.root, isWcoVisible ? $style.wco : null]">
	<div :class="$style.title">
		<img :src="instance.iconUrl || '/favicon.ico'" alt="" :class="$style.instanceIcon"/>
		<span :class="$style.instanceTitle">{{ instance.name ?? host }}</span>
	</div>
	<div :class="$style.controls">
		<button
			v-if="canBack"
			class="_button"
			:class="[
				$style.button,
				moveBackButtonToRightSideOfTitlebar ? $style.buttonRight : $style.buttonLeft,
			]"
			@click="goBack"
		>
			<i class="ti ti-arrow-left"></i>
		</button>
	</div>
</div>
</template>

<script lang="ts" setup>
import { host } from '@@/js/config.js';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { instance } from '@/instance.js';
import { prefer } from '@/preferences.js';

const canBack = ref(true);
const moveBackButtonToRightSideOfTitlebar = ref(prefer.s.moveBackButtonToRightSideOfTitlebar);
const isWcoVisible = ref(false);

type WindowControlsOverlayLike = {
	visible: boolean;
	addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
	removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
};

function getWindowControlsOverlay(): WindowControlsOverlayLike | undefined {
	return (navigator as Navigator & { windowControlsOverlay?: WindowControlsOverlayLike }).windowControlsOverlay;
}

function updateWcoState() {
	const overlay = getWindowControlsOverlay();
	isWcoVisible.value = overlay?.visible ?? false;
}

onMounted(() => {
	const overlay = getWindowControlsOverlay();
	updateWcoState();
	overlay?.addEventListener?.('geometrychange', updateWcoState);
	overlay?.addEventListener?.('visibilitychange', updateWcoState);
});

onBeforeUnmount(() => {
	const overlay = getWindowControlsOverlay();
	overlay?.removeEventListener?.('geometrychange', updateWcoState);
	overlay?.removeEventListener?.('visibilitychange', updateWcoState);
});

function goBack() {
	window.history.back();
}
</script>

<style lang="scss" module>
.root {
	--height: 36px;
	--wco-x: env(titlebar-area-x, 0px);
	--wco-width: env(titlebar-area-width, 100vw);
	--wco-right: calc(100vw - var(--wco-x) - var(--wco-width));
	position: relative;
	app-region: drag;
	user-select: none;
	background: var(--MI_THEME-navBg);
	height: var(--height);
	font-size: 90%;
}

.wco {
	height: max(var(--height), env(titlebar-area-height, var(--height)));
}

.title {
	position: absolute;
	top: 0;
	bottom: 0;
	left: var(--wco-x);
	right: var(--wco-right);
	app-region: drag;
	display: flex;
	justify-content: center;
	align-items: center;
	text-align: center;
	min-width: 0;
	padding: 0 8px;
}

.controls {
	position: absolute;
	top: 0;
	bottom: 0;
	left: var(--wco-x);
	right: var(--wco-right);
	pointer-events: none;
	app-region: drag;
}

.instanceIcon {
	display: inline-block;
	width: 20px;
	aspect-ratio: 1;
	border-radius: 5px;
	margin-right: 8px;
}

.instanceTitle {
	display: inline-block;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	pointer-events: none;
}

.button {
	position: absolute;
	top: 0;
	bottom: 0;
	width: var(--height);
	pointer-events: auto;
	app-region: no-drag;
	display: grid;
	place-items: center;
}

.buttonLeft {
	inset-inline-start: 0;
}

.buttonRight {
	inset-inline-end: 0;
}
</style>
