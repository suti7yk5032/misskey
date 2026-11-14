<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_spacer" style="--MI_SPACER-w: 900px;">
	<div class="_gaps">
		<!-- 1. ユーザー選択 -->
		<template v-if="view === 'setup'">
			<MkInfo>{{ i18n.ts._reactionReport.description }}</MkInfo>

			<div class="_panel" :class="$style.block">
				<div :class="$style.sectionTitle">{{ i18n.ts._reactionReport.targets }} ({{ targets.length }})</div>

				<div v-if="targets.length === 0" :class="$style.hint">{{ i18n.ts._reactionReport.selectAtLeastOne }}</div>
				<div v-else :class="$style.chips">
					<span v-for="u in targets" :key="u.id" :class="$style.targetChip">
						<MkMention :username="u.username" :host="u.host ?? localHost"/>
						<button
							type="button" :class="$style.chipRemove" :title="i18n.ts._reactionReport.removeUser"
							@click.prevent="toggle(u)"
						>×</button>
					</span>
				</div>

				<div :class="$style.addRow">
					<MkInput v-model="nameInput" :placeholder="i18n.ts._reactionReport.addUser">
						<template #prefix><i class="ti ti-user-plus"></i></template>
					</MkInput>
					<MkButton :disabled="nameInput.trim() === ''" @click="addNames">{{ i18n.ts._reactionReport.add }}</MkButton>
				</div>
				<div v-if="errorText" :class="$style.error">{{ errorText }}</div>

				<div :class="$style.sectionTitle">{{ i18n.ts._reactionReport.fromLists }}</div>
				<div v-if="listsError" :class="$style.error">{{ listsError }}</div>
				<div v-else-if="lists.length === 0" :class="$style.hint">{{ i18n.ts._reactionReport.noLists }}</div>
				<div v-else :class="$style.lists">
					<div v-for="list in lists" :key="list.id" :class="$style.listCard">
						<div :class="$style.listHead">
							<b>{{ list.name }}</b>
							<span :class="$style.hint">{{ list.members.length }}</span>
							<MkButton small @click="toggleList(list, !isListSelected(list))">
								{{ isListSelected(list) ? i18n.ts._reactionReport.removeAll : i18n.ts._reactionReport.addAll }}
							</MkButton>
						</div>
						<div :class="$style.chips">
							<span
								v-for="m in list.members" :key="m.id"
								:class="[$style.member, isSelected(m.id) ? $style.memberOn : null]"
							>
								<MkMention :username="m.username" :host="m.host ?? localHost"/>
								<button
									type="button" :class="[$style.memberToggle, isSelected(m.id) ? $style.memberToggleOn : null]"
									:title="isSelected(m.id) ? i18n.ts._reactionReport.removeUser : i18n.ts._reactionReport.add"
									:aria-pressed="isSelected(m.id)" @click.prevent="toggle(m)"
								>
									<i :class="isSelected(m.id) ? 'ti ti-minus' : 'ti ti-plus'"></i>
								</button>
							</span>
						</div>
					</div>
				</div>
			</div>

			<MkButton primary large :disabled="targets.length === 0" @click="run">
				<i class="ti ti-chart-bar"></i> {{ i18n.ts._reactionReport.run }}
			</MkButton>
		</template>

		<!-- 2. 実行中 -->
		<template v-else-if="view === 'running'">
			<div class="_panel" :class="$style.block">
				<div :class="$style.progress">
					<MkLoading/>
					<span>{{ i18n.ts._reactionReport.running }}</span>
				</div>
				<div :class="$style.hint">
					{{ i18n.tsx._reactionReport.progress({ current: progress.index + 1, total: progress.total }) }}<template
						v-if="progress.current"
					>
						· @{{ progress.current }}
					</template>
					· {{ i18n.tsx._reactionReport.fetched({ n: progress.fetched }) }}
				</div>
				<div :class="$style.addRow">
					<MkButton @click="cancel">{{ i18n.ts.cancel }}</MkButton>
				</div>
			</div>
		</template>

		<!-- 3. 集計結果 -->
		<template v-else-if="view === 'result' && stats">
			<div :class="$style.toolbar">
				<MkButton @click="run"><i class="ti ti-refresh"></i> {{ i18n.ts.reload }}</MkButton>
				<MkButton @click="view = 'setup'">
					<i class="ti ti-users"></i> {{ i18n.ts._reactionReport.reselect }}
				</MkButton>
			</div>

			<div :class="$style.kpis">
				<div class="_panel" :class="$style.kpi">
					<span :class="$style.kpiLabel">{{ i18n.ts._reactionReport.reactionCount }}</span>
					<b>{{ stats.totals.reactions.toLocaleString() }}</b>
				</div>
				<div class="_panel" :class="$style.kpi">
					<span :class="$style.kpiLabel">{{ i18n.ts._reactionReport.emojiCount }}</span>
					<b>{{ stats.totals.distinct.toLocaleString() }}</b>
				</div>
				<div class="_panel" :class="$style.kpi">
					<span :class="$style.kpiLabel">{{ i18n.ts._reactionReport.userCount }}</span>
					<b>{{ stats.totals.users.toLocaleString() }}</b>
				</div>
			</div>

			<div class="_panel" :class="$style.block">
				<div :class="$style.sectionTitle">{{ i18n.ts._reactionReport.byEmoji }}</div>
				<div v-if="stats.emojis.length === 0" :class="$style.hint">{{ i18n.ts._reactionReport.noReactions }}</div>
				<div v-else :class="$style.chart">
					<div v-for="(emoji, index) in shownEmojis" :key="emoji.type" :class="$style.row" @click="openEmoji(emoji)">
						<span :class="$style.icon">
							<MkReactionIcon :reaction="emoji.type" :noStyle="true"/>
						</span>
						<span :class="$style.label">{{ emoji.kind === 'custom' ? reactionLabel(emoji.type) : '' }}</span>
						<span :class="$style.track">
							<span :class="$style.fill" :style="{ width: barWidth(emoji.count) }">
								<span
									v-for="(n, username) in sortedByUser(emoji)" :key="username" :class="$style.seg"
									:style="{ width: `${(n / Math.max(emoji.count, 1)) * 100}%`, background: colorOf(username) }"
									:title="`@${username}: ${n}`"
								></span>
							</span>
						</span>
						<span :class="$style.count">{{ emoji.count.toLocaleString() }}<span :class="$style.pct">{{
							pct(emoji.count) }}</span></span>
					</div>
				</div>
				<div v-if="stats.emojis.length > shownEmojis.length" :class="$style.hint" style="margin-top: 8px;">
					{{ i18n.tsx._reactionReport.showingTop({ shown: shownEmojis.length, total: stats.emojis.length }) }}
				</div>
			</div>

			<div class="_panel" :class="$style.block">
				<div :class="$style.sectionTitle">{{ i18n.ts._reactionReport.byUser }}</div>
				<div :class="$style.chips">
					<span v-for="u in stats.users" :key="u.id" :class="$style.chip">
						<span :class="$style.dot" :style="{ background: colorOf(u.username) }"></span>
						<span>{{ u.name }}</span>
						<b>{{ u.count.toLocaleString() }}</b>
					</span>
				</div>
			</div>
		</template>

		<!-- 4. 絵文字の詳細 -->
		<template v-else-if="view === 'emoji' && selectedEmoji">
			<MkButton @click="view = 'result'"><i class="ti ti-arrow-left"></i> {{ i18n.ts._reactionReport.back }}</MkButton>

			<div class="_panel" :class="$style.block">
				<div :class="$style.detailHead">
					<span :class="$style.detailIcon">
						<MkReactionIcon :reaction="selectedEmoji.type" :noStyle="true"/>
					</span>
					<div>
						<b>{{ reactionLabel(selectedEmoji.type) }}</b>
						<div :class="$style.hint">
							{{ selectedEmoji.count.toLocaleString() }}{{ i18n.ts._reactionReport.reactionsSuffix }} ·
							{{ pct(selectedEmoji.count) }} ·
							{{ i18n.tsx._reactionReport.notesCount({ n: detailNotes.total }) }}
						</div>
					</div>
				</div>
				<div :class="$style.chips">
					<span v-for="u in detailUsers" :key="u.username" :class="$style.chip">
						<span :class="$style.dot" :style="{ background: colorOf(u.username) }"></span>
						<span>@{{ u.username }}</span>
						<b>{{ u.count.toLocaleString() }}</b>
					</span>
				</div>
			</div>

			<div v-if="detailNotes.notes.length === 0" :class="$style.hint">{{ i18n.ts._reactionReport.noNotes }}</div>
			<div v-for="entry in detailNotes.notes" :key="entry.note.id" :class="$style.noteCard">
				<MkNoteDetailed :note="entry.note"/>
				<div :class="$style.reactors">
					<span :class="$style.hint">{{ i18n.ts._reactionReport.reactedBy }}</span>
					<span v-for="r in entry.reactors" :key="r.username" :class="$style.reactor">@{{ r.username }}</span>
				</div>
			</div>
		</template>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, onActivated, onUnmounted, ref } from 'vue';
import * as Misskey from 'misskey-js';
import { host as localHost } from '@@/js/config.js';
import type { EmojiStat, ReportStats, TargetUser } from '@/scripts/reaction-report/types.js';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkMention from '@/components/MkMention.vue';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import MkNoteDetailed from '@/components/MkNoteDetailed.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { ensureSignin } from '@/i.js';
import { aggregate } from '@/scripts/reaction-report/aggregate.js';
import { reactionLabel } from '@/scripts/reaction-report/emoji-type.js';

const $i = ensureSignin();

type View = 'setup' | 'running' | 'result' | 'emoji';

interface CollectedReaction {
	id: string;
	type: string;
	createdAt: string;
	userId: string;
	note: Misskey.entities.Note | null;
}

interface NoteListEntry {
	note: Misskey.entities.Note;
	reactors: { username: string; createdAt: string }[];
	lastReactedAt: string;
}

const PAGE_SIZE = 100;
const MAX_ROWS = 100;
const MAX_NOTES = 30;

const view = ref<View>('setup');
const targets = ref<TargetUser[]>([{
	id: $i.id,
	username: $i.username,
	name: $i.name,
	host: $i.host,
	avatarUrl: $i.avatarUrl,
}]);
const nameInput = ref('');
const lists = ref<{ id: string; name: string; members: TargetUser[] }[]>([]);
const listsError = ref<string | null>(null);
const errorText = ref<string | null>(null);
const running = ref(false);
const progress = ref({ index: 0, total: 0, fetched: 0, current: '' });
const collected = ref<CollectedReaction[]>([]);
const stats = ref<ReportStats | null>(null);
const instanceName = ref<string | null>(null);
const selectedEmoji = ref<EmojiStat | null>(null);

let controller: AbortController | null = null;

const usernameById = computed(() => new Map(targets.value.map((u) => [u.id, u.username])));
const userColorIndex = computed(() => new Map(stats.value?.users.map((u, i) => [u.username, i]) ?? []));

const shownEmojis = computed(() => (stats.value?.emojis ?? []).slice(0, MAX_ROWS));
const maxCount = computed(() => shownEmojis.value.reduce((m, e) => Math.max(m, e.count), 0) || 1);

const detailUsers = computed(() => {
	const emoji = selectedEmoji.value;
	if (!emoji) return [];
	return Object.entries(emoji.byUser)
		.map(([username, count]) => ({ username, count }))
		.sort((a, b) => b.count - a.count);
});

const detailNotes = computed<{ total: number; notes: NoteListEntry[] }>(() => {
	const emoji = selectedEmoji.value;
	if (!emoji) return { total: 0, notes: [] };

	const map = new Map<string, NoteListEntry>();
	for (const r of collected.value) {
		if (r.type !== emoji.type || r.note == null) continue;
		let entry = map.get(r.note.id);
		if (entry == null) {
			entry = { note: r.note, reactors: [], lastReactedAt: r.createdAt };
			map.set(r.note.id, entry);
		}
		const username = usernameById.value.get(r.userId) ?? r.userId;
		if (!entry.reactors.some((x) => x.username === username)) {
			entry.reactors.push({ username, createdAt: r.createdAt });
		}
		if (r.createdAt > entry.lastReactedAt) entry.lastReactedAt = r.createdAt;
	}

	const all = [...map.values()].sort((a, b) => b.lastReactedAt.localeCompare(a.lastReactedAt));
	return { total: all.length, notes: all.slice(0, MAX_NOTES) };
});

function isSelected(id: string): boolean {
	return targets.value.some((u) => u.id === id);
}

function isListSelected(list: { members: TargetUser[] }): boolean {
	return list.members.length > 0 && list.members.every((m) => isSelected(m.id));
}

function toggle(user: TargetUser): void {
	const index = targets.value.findIndex((u) => u.id === user.id);
	if (index >= 0) targets.value.splice(index, 1);
	else targets.value.push(user);
}

function toggleList(list: { members: TargetUser[] }, add: boolean): void {
	if (add) {
		for (const m of list.members) if (!isSelected(m.id)) targets.value.push(m);
	} else {
		targets.value = targets.value.filter((u) => !list.members.some((m) => m.id === u.id));
	}
}

async function addNames(): Promise<void> {
	errorText.value = null;
	const names = nameInput.value.split(/[,\s、]+/u).map((s) => s.trim().replace(/^@/u, '')).filter((s) => s !== '');
	nameInput.value = '';
	const failed: string[] = [];

	for (const name of names) {
		if (name.includes('@')) {
			failed.push(name);
			continue;
		}
		try {
			const user = await misskeyApi('users/show', { username: name });
			if (!isSelected(user.id)) {
				targets.value.push({ id: user.id, username: user.username, name: user.name, host: user.host, avatarUrl: user.avatarUrl });
			}
		} catch {
			failed.push(name);
		}
	}

	if (failed.length > 0) {
		errorText.value = i18n.tsx._reactionReport.userNotFound({ names: failed.map((n) => `@${n}`).join(', ') });
	}
}

async function loadLists(): Promise<void> {
	if (lists.value.length > 0) return;
	try {
		const raw = await misskeyApi('users/lists/list');
		const ids = [...new Set(raw.flatMap((l) => l.userIds ?? []))];
		const users = ids.length > 0 ? await misskeyApi('users/show', { userIds: ids }) : [];
		const byId = new Map(users.map((u) => [u.id, u]));
		lists.value = raw.map((l) => ({
			id: l.id,
			name: l.name,
			members: (l.userIds ?? [])
				.map((id) => byId.get(id))
				.filter((u): u is Misskey.entities.UserDetailed => u != null)
				.map((u) => ({ id: u.id, username: u.username, name: u.name, host: u.host, avatarUrl: u.avatarUrl })),
		}));
	} catch (err) {
		listsError.value = err instanceof Error ? err.message : String(err);
	}
}

function cancel(): void {
	controller?.abort();
	controller = null;
	running.value = false;
	view.value = 'setup';
}

async function run(): Promise<void> {
	if (targets.value.length === 0) {
		await os.alert({ type: 'warning', text: i18n.ts._reactionReport.selectAtLeastOne });
		return;
	}

	controller?.abort();
	const ac = new AbortController();
	controller = ac;

	view.value = 'running';
	running.value = true;
	errorText.value = null;
	collected.value = [];
	stats.value = null;
	progress.value = { index: 0, total: targets.value.length, fetched: 0, current: '' };

	try {
		const meta = await misskeyApi('meta', { detail: false }).catch(() => null);
		instanceName.value = meta?.name ?? null;

		const rows: CollectedReaction[] = [];
		for (const [i, user] of targets.value.entries()) {
			progress.value = { ...progress.value, index: i, current: user.username };

			let untilId: string | undefined;
			for (; ;) {
				const page = await misskeyApi('users/reactions', {
					userId: user.id,
					limit: PAGE_SIZE,
					untilId,
				}, null, ac.signal);

				for (const r of page) {
					rows.push({ id: r.id, type: r.type, createdAt: r.createdAt, userId: user.id, note: r.note ?? null });
				}
				progress.value = { ...progress.value, fetched: rows.length };

				const oldest = page.at(-1);
				if (oldest == null || page.length < PAGE_SIZE) break;
				untilId = oldest.id;
			}
		}

		if (ac.signal.aborted) return;

		collected.value = rows;
		stats.value = aggregate({
			origin: window.location.host,
			instanceName: instanceName.value,
			users: targets.value,
			reactions: rows.map((r) => ({ id: r.id, type: r.type, createdAt: r.createdAt, userId: r.userId })),
		});
		view.value = 'result';
		window.document.title = `${i18n.ts._reactionReport.title} | ${instanceName.value ?? window.location.host}`;
	} catch (err) {
		if (ac.signal.aborted) return;
		errorText.value = err instanceof Error ? err.message : String(err);
		view.value = 'setup';
		await os.alert({ type: 'error', text: errorText.value });
	} finally {
		running.value = false;
		if (controller === ac) controller = null;
	}
}

function openEmoji(emoji: EmojiStat): void {
	selectedEmoji.value = emoji;
	view.value = 'emoji';
	window.scrollTo({ top: 0, behavior: 'smooth' });
}

function colorOf(username: string): string {
	const index = userColorIndex.value.get(username) ?? 0;
	return `hsl(${(index * 47) % 360} 65% 55%)`;
}

function sortedByUser(emoji: EmojiStat): Record<string, number> {
	return Object.fromEntries(Object.entries(emoji.byUser).sort((a, b) => b[1] - a[1]));
}

function barWidth(count: number): string {
	return `${Math.max((count / maxCount.value) * 100, 1)}%`;
}

function pct(count: number): string {
	const total = stats.value?.totals.reactions ?? 0;
	if (total === 0) return '0%';
	const v = (count / total) * 100;
	return v > 0 && v < 0.1 ? '<0.1%' : `${v.toFixed(1)}%`;
}

onActivated(() => {
	void loadLists();
});

void loadLists();

// ページ離脱時に走っている取得を止める
onUnmounted(() => {
	controller?.abort();
});
</script>

<style lang="scss" module>
.block {
	padding: 16px;
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.sectionTitle {
	font-weight: 700;
	font-size: 0.95em;
	margin-top: 4px;
}

.hint {
	font-size: 0.85em;
	opacity: 0.7;
}

.error {
	font-size: 0.85em;
	color: var(--MI_THEME-error);
}

.chips {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	align-items: center;
}

.chip {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	border: solid 1px var(--MI_THEME-divider);
	border-radius: 999px;
	padding: 2px 10px;
	font-size: 0.85em;
	background: var(--MI_THEME-panelHighlight);
}

.targetChip {
	display: inline-flex;
	align-items: center;
	gap: 2px;
}

.chipRemove {
	border: none;
	background: none;
	color: var(--MI_THEME-fgTransparentWeak);
	cursor: pointer;
	font-size: 1em;
	line-height: 1;
	padding: 0 2px;

	&:hover {
		color: var(--MI_THEME-error);
	}
}

.dot {
	width: 9px;
	height: 9px;
	border-radius: 50%;
	display: inline-block;
}

.addRow {
	display: flex;
	gap: 8px;
	align-items: flex-end;

	> :first-child {
		flex: 1;
	}
}

.lists {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.listCard {
	border: solid 1px var(--MI_THEME-divider);
	border-radius: 8px;
	padding: 10px 12px;
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.listHead {
	display: flex;
	align-items: center;
	gap: 8px;

	>b {
		font-size: 0.95em;
	}

	> :last-child {
		margin-left: auto;
	}
}

.member {
	display: inline-flex;
	align-items: center;
	gap: 2px;
	border-radius: 999px;
	outline: 2px solid transparent;
	outline-offset: 1px;

	&:hover {
		outline-color: var(--MI_THEME-divider);
	}
}

.memberOn {
	outline-color: var(--MI_THEME-accent);
}

.memberToggle {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 22px;
	border: solid 1px var(--MI_THEME-divider);
	border-radius: 50%;
	background: var(--MI_THEME-panel);
	color: var(--MI_THEME-fgTransparentWeak);
	cursor: pointer;
	font-size: 0.8em;
	line-height: 1;

	&:hover {
		border-color: var(--MI_THEME-accent);
		color: var(--MI_THEME-accent);
	}
}

.memberToggleOn {
	border-color: var(--MI_THEME-accent);
	color: var(--MI_THEME-accent);

	&:hover {
		border-color: var(--MI_THEME-error);
		color: var(--MI_THEME-error);
	}
}

.progress {
	display: flex;
	align-items: center;
	gap: 8px;
	font-weight: 700;
}

.toolbar {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.kpis {
	display: flex;
	gap: 8px;
	flex-wrap: wrap;

	>div {
		flex: 1;
		min-width: 120px;
	}
}

.kpi {
	padding: 12px 14px;
	display: flex;
	flex-direction: column;
	gap: 2px;

	>b {
		font-size: 1.4em;
	}
}

.kpiLabel {
	font-size: 0.8em;
	opacity: 0.7;
}

.chart {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.row {
	display: grid;
	grid-template-columns: 34px minmax(80px, 150px) 1fr 90px;
	gap: 10px;
	align-items: center;
	padding: 3px 4px;
	border-radius: 8px;
	cursor: pointer;

	&:hover {
		background: var(--MI_THEME-panelHighlight);
	}
}

.icon {
	display: flex;
	justify-content: center;
	font-size: 1.5em;
}

.label {
	font-size: 0.8em;
	opacity: 0.7;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.track {
	height: 20px;
	background: var(--MI_THEME-bg);
	border-radius: 6px;
	overflow: hidden;
	display: block;
}

.fill {
	display: flex;
	height: 100%;
	border-radius: 6px;
	overflow: hidden;
}

.seg {
	height: 100%;
	display: block;
}

.count {
	text-align: right;
	font-variant-numeric: tabular-nums;
	font-size: 0.9em;
}

.pct {
	display: block;
	font-size: 0.75em;
	opacity: 0.6;
}

.detailHead {
	display: flex;
	align-items: center;
	gap: 12px;

	>div>b {
		font-size: 1.1em;
	}
}

.detailIcon {
	font-size: 2.2em;
	display: flex;
	align-items: center;
}

.noteCard {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.reactors {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	align-items: center;
	padding: 0 4px 8px;
}

.reactor {
	font-size: 0.8em;
	border: solid 1px var(--MI_THEME-divider);
	border-radius: 999px;
	padding: 1px 8px;
}

@media (max-width: 600px) {
	.row {
		grid-template-columns: 28px 1fr 80px;
	}

	.label {
		display: none;
	}
}
</style>
