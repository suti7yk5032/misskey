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
					<MkButton @click="pickUser"><i class="ti ti-user-plus"></i> {{ i18n.ts.selectUser }}</MkButton>
				</div>
				<div v-if="errorText" :class="$style.error">{{ errorText }}</div>
			</div>

			<MkButton primary large :disabled="targets.length === 0" @click="run">
				<i class="ti ti-chart-bar"></i> {{ i18n.ts._reactionReport.run }}
			</MkButton>

			<div v-if="summaries.length > 0" class="_panel" :class="$style.block">
				<div :class="$style.sectionTitle">{{ i18n.ts._reactionReport.cacheTitle }}</div>
				<div v-for="s in summaries" :key="s.id" :class="$style.cacheRow">
					<div :class="$style.cacheInfo">
						<b>{{ formatSavedAt(s.savedAt) }}</b>
						<span :class="$style.hint">
							{{ i18n.tsx._reactionReport.cacheMeta({ users: s.targets.length, reactions: s.reactionCount }) }}
						</span>
					</div>
					<MkButton small @click="openCached(s)"><i class="ti ti-folder-open"></i> {{ i18n.ts._reactionReport.cacheOpen }}</MkButton>
					<MkButton small danger :title="i18n.ts._reactionReport.cacheDelete" @click="removeCached(s)"><i class="ti ti-trash"></i></MkButton>
				</div>
			</div>
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

			<div v-if="cachedAt != null" :class="$style.cacheBanner">
				<i class="ti ti-database"></i>
				{{ i18n.tsx._reactionReport.cacheViewing({ date: formatSavedAt(cachedAt) }) }}
			</div>
			<div v-else-if="cacheNotice != null" :class="$style.hint">{{ cacheNotice }}</div>

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
				<div :class="$style.sectionTitle">{{ i18n.ts._reactionReport.byUser }}</div>
				<div :class="$style.chips">
					<span v-for="u in stats.users" :key="u.id" :class="$style.chip">
						<span :class="$style.dot" :style="{ background: colorOf(u.username) }"></span>
						<span>{{ u.name }}</span>
						<b>{{ u.count.toLocaleString() }}</b>
					</span>
				</div>
			</div>

			<div class="_panel" :class="$style.block">
				<div :class="$style.sectionTitle">{{ i18n.ts._reactionReport.byEmoji }}</div>
				<div v-if="stats.emojis.length === 0" :class="$style.hint">{{ i18n.ts._reactionReport.noReactions }}</div>
				<div v-else :class="$style.chart">
					<div v-for="emoji in shownEmojis" :key="emoji.type" :class="$style.row" @click="openEmoji(emoji)">
						<div :class="$style.rowEmoji">
							<MkReactionIcon :reaction="emoji.type"/>
						</div>
						<div :class="$style.rowBar">
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
				</div>
				<div v-if="stats.emojis.length > shownEmojis.length" :class="$style.hint" style="margin-top: 8px;">
					{{ i18n.tsx._reactionReport.showingTop({ shown: shownEmojis.length, total: stats.emojis.length }) }}
				</div>
			</div>
		</template>

		<!-- 4. 絵文字の詳細 -->
		<template v-else-if="view === 'emoji' && selectedEmoji">
			<MkButton @click="view = 'result'"><i class="ti ti-arrow-left"></i> {{ i18n.ts._reactionReport.back }}</MkButton>

			<div class="_panel" :class="$style.block">
				<div :class="$style.detailHead">
					<div :class="$style.detailEmoji">
						<MkReactionIcon :reaction="selectedEmoji.type"/>
					</div>
					<div :class="$style.detailMeta">
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
import type { NoteListEntry, ReportSummary } from '@/scripts/reaction-report/snapshot.js';
import MkButton from '@/components/MkButton.vue';
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
import { buildSnapshot, reportKey, toSummary, MAX_NOTES_PER_EMOJI } from '@/scripts/reaction-report/snapshot.js';
import { deleteReport, getReport, listReports, saveReport } from '@/scripts/reaction-report/cache.js';

const $i = ensureSignin();

type View = 'setup' | 'running' | 'result' | 'emoji';

interface CollectedReaction {
	id: string;
	type: string;
	createdAt: string;
	userId: string;
	note: Misskey.entities.Note | null;
}

const PAGE_SIZE = 100;
const MAX_ROWS = 100;
const MAX_NOTES = MAX_NOTES_PER_EMOJI;

const view = ref<View>('setup');
const targets = ref<TargetUser[]>([{
	id: $i.id,
	username: $i.username,
	name: $i.name,
	host: $i.host,
	avatarUrl: $i.avatarUrl,
}]);
const errorText = ref<string | null>(null);
const running = ref(false);
const progress = ref({ index: 0, total: 0, fetched: 0, current: '' });
const collected = ref<CollectedReaction[]>([]);
const stats = ref<ReportStats | null>(null);
const instanceName = ref<string | null>(null);
const selectedEmoji = ref<EmojiStat | null>(null);

// ブラウザ内キャッシュ
const summaries = ref<ReportSummary[]>([]);
const cachedNotes = ref<Record<string, NoteListEntry[]> | null>(null);
const cachedTotals = ref<Record<string, number> | null>(null);
const cachedAt = ref<string | null>(null);
const cacheNotice = ref<string | null>(null);

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

	// キャッシュから開いた場合は保存済みのノートを使う
	if (cachedNotes.value != null) {
		const notes = cachedNotes.value[emoji.type] ?? [];
		return { total: cachedTotals.value?.[emoji.type] ?? notes.length, notes };
	}

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

function toggle(user: TargetUser): void {
	const index = targets.value.findIndex((u) => u.id === user.id);
	if (index >= 0) targets.value.splice(index, 1);
	else targets.value.push(user);
}

async function pickUser(): Promise<void> {
	errorText.value = null;
	const picked = await os.selectUsers({ includeSelf: true, localOnly: true });
	for (const user of picked) {
		if (!isSelected(user.id)) {
			targets.value.push({ id: user.id, username: user.username, name: user.name, host: user.host, avatarUrl: user.avatarUrl });
		}
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
				// トークンを明示的に渡す（undefined 以外を渡すと $i.token の自動付与が上書きされるため、
				// null を渡すと未認証扱いになり、非公開ノートへのリアクションが取れなくなる）
				const page = await misskeyApi('users/reactions', {
					userId: user.id,
					limit: PAGE_SIZE,
					untilId,
				}, $i.token, ac.signal);

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

		// ブラウザ内キャッシュに保存（次回以降ここから見返せる）
		cachedNotes.value = null;
		cachedTotals.value = null;
		cachedAt.value = null;
		const snapshot = buildSnapshot({
			origin: window.location.host,
			instanceName: instanceName.value,
			targets: targets.value,
			stats: stats.value,
			reactions: rows,
			usernameById: usernameById.value,
		});
		const saved = await saveReport(snapshot, toSummary(snapshot));
		cacheNotice.value = saved ? i18n.ts._reactionReport.cacheSaved : i18n.ts._reactionReport.cacheSaveFailed;
		await refreshSummaries();
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

async function refreshSummaries(): Promise<void> {
	summaries.value = await listReports();
}

/** 保存済みの集計を開く（API は叩かない） */
async function openCached(summary: ReportSummary): Promise<void> {
	const snapshot = await getReport(summary.id);
	if (snapshot == null) {
		await refreshSummaries();
		return;
	}

	stats.value = snapshot.stats;
	instanceName.value = snapshot.instanceName;
	targets.value = snapshot.targets;
	cachedNotes.value = snapshot.notes;
	cachedTotals.value = snapshot.noteTotals;
	cachedAt.value = snapshot.savedAt;
	cacheNotice.value = null;
	collected.value = [];
	errorText.value = null;
	view.value = 'result';
	window.scrollTo({ top: 0 });
}

async function removeCached(summary: ReportSummary): Promise<void> {
	const confirm = await os.confirm({
		type: 'warning',
		text: i18n.ts._reactionReport.cacheDeleteConfirm,
	});
	if (confirm.canceled) return;
	await deleteReport(summary.id);
	await refreshSummaries();
	if (cachedAt.value === summary.savedAt) {
		cachedAt.value = null;
		cachedNotes.value = null;
		cachedTotals.value = null;
		stats.value = null;
		view.value = 'setup';
	}
}

function formatSavedAt(iso: string): string {
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/** 初回: キャッシュ一覧を読み、同じ条件の保存結果があれば開く */
async function init(): Promise<void> {
	await refreshSummaries();
	if (stats.value != null) return;
	const hit = summaries.value.find((s) => s.id === reportKey(window.location.host, targets.value));
	if (hit != null) await openCached(hit);
}

onActivated(() => {
	void init();
});

void init();

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

.cacheBanner {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 0.85em;
	color: var(--MI_THEME-accent);
	background: var(--MI_THEME-accentedBg);
	border-radius: 8px;
	padding: 6px 10px;
}

.cacheRow {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 6px 0;
	border-bottom: solid 1px var(--MI_THEME-divider);

	&:last-child {
		border-bottom: none;
	}
}

.cacheInfo {
	display: flex;
	flex-direction: column;
	gap: 2px;
	flex: 1;
	min-width: 0;
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
	gap: 8px;
}

// 1件 = 1行目が絵文字、2行目が棒グラフ（列幅の計算を不要にして、横長絵文字も切れないようにする）
.row {
	display: flex;
	flex-direction: column;
	gap: 2px;
	padding: 4px;
	border-radius: 8px;
	cursor: pointer;

	&:hover {
		background: var(--MI_THEME-panelHighlight);
	}
}

.rowEmoji {
	display: flex;
	align-items: center;
	justify-content: flex-start;
	min-height: 32px;
	font-size: 1.6em;
	line-height: 1;

	// 幅は枠（カード幅）いっぱいまで使えるので、横長の絵文字も縮小されずに収まる
	:deep(img) {
		min-width: 0;
		width: auto;
		height: auto;
		max-width: 100%;
		max-height: 32px;
		object-fit: contain;
	}
}

.rowBar {
	display: flex;
	align-items: center;
	gap: 10px;
}

.track {
	flex: 1;
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
	width: 84px;
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
	flex-direction: column;
	gap: 6px;
}

// 詳細でも絵文字は専用の行に置く（横長のバナー絵文字でも切れないように）
.detailEmoji {
	display: flex;
	align-items: center;
	justify-content: flex-start;
	min-height: 48px;
	font-size: 2em;
	line-height: 1;

	:deep(img) {
		min-width: 0;
		width: auto;
		height: auto;
		max-width: 100%;
		max-height: 64px;
		object-fit: contain;
	}
}

.detailMeta {
	> b {
		font-size: 1.1em;
	}
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
	.rowEmoji {
		min-height: 24px;
		font-size: 1.4em;

		:deep(img) {
			max-height: 24px;
		}
	}

	.count {
		width: 70px;
	}
}
</style>
