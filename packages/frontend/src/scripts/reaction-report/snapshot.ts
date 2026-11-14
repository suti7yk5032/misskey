/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type * as Misskey from 'misskey-js';
import type { ReportStats, TargetUser } from './types.js';

/** 1絵文字あたりに保存するノート数 */
export const MAX_NOTES_PER_EMOJI = 30;
/** スナップショット全体で保存するノート数の上限（容量対策） */
export const MAX_NOTES_TOTAL = 1000;

export interface NoteListEntry {
	note: Misskey.entities.Note;
	reactors: { username: string; createdAt: string }[];
	lastReactedAt: string;
}

/** ブラウザに保存する集計結果の一式 */
export interface ReportSnapshot {
	/** origin + 対象ユーザーで決まるキー（同じ条件なら上書き） */
	id: string;
	savedAt: string;
	origin: string;
	instanceName: string | null;
	targets: TargetUser[];
	stats: ReportStats;
	notes: Record<string, NoteListEntry[]>;
	/** 絵文字ごとのノート総数（保存したノートは上限で切られている） */
	noteTotals: Record<string, number>;
	notesTruncated: boolean;
}

/** 一覧表示用の軽いメタ情報 */
export interface ReportSummary {
	id: string;
	savedAt: string;
	origin: string;
	instanceName: string | null;
	targets: TargetUser[];
	reactionCount: number;
	emojiCount: number;
}

export function reportKey(origin: string, targets: TargetUser[]): string {
	return `${origin}|${targets.map((t) => t.id).sort().join(',')}`;
}

export function toSummary(snapshot: ReportSnapshot): ReportSummary {
	return {
		id: snapshot.id,
		savedAt: snapshot.savedAt,
		origin: snapshot.origin,
		instanceName: snapshot.instanceName,
		targets: snapshot.targets,
		reactionCount: snapshot.stats.totals.reactions,
		emojiCount: snapshot.stats.totals.distinct,
	};
}

export interface RawCollectedReaction {
	id: string;
	type: string;
	createdAt: string;
	userId: string;
	note: Misskey.entities.Note | null;
}

export interface BuildSnapshotInput {
	origin: string;
	instanceName: string | null;
	targets: TargetUser[];
	stats: ReportStats;
	reactions: RawCollectedReaction[];
	usernameById: Map<string, string>;
	savedAt?: string;
}

/**
 * 集計結果から保存用スナップショットを作る。
 * - ノートは絵文字ごとに新しいリアクション順で MAX_NOTES_PER_EMOJI 件まで
 * - 全体でも MAX_NOTES_TOTAL 件まで（多いときは件数の多い絵文字を優先）
 */
export function buildSnapshot(input: BuildSnapshotInput): ReportSnapshot {
	const grouped = new Map<string, Map<string, NoteListEntry>>();

	for (const r of input.reactions) {
		if (r.note == null) continue;
		let notes = grouped.get(r.type);
		if (notes == null) {
			notes = new Map();
			grouped.set(r.type, notes);
		}
		let entry = notes.get(r.note.id);
		if (entry == null) {
			entry = { note: r.note, reactors: [], lastReactedAt: r.createdAt };
			notes.set(r.note.id, entry);
		}
		const username = input.usernameById.get(r.userId) ?? r.userId;
		if (!entry.reactors.some((x) => x.username === username)) {
			entry.reactors.push({ username, createdAt: r.createdAt });
		}
		if (r.createdAt > entry.lastReactedAt) entry.lastReactedAt = r.createdAt;
	}

	const notes: Record<string, NoteListEntry[]> = {};
	const noteTotals: Record<string, number> = {};
	let truncated = false;
	let budget = MAX_NOTES_TOTAL;

	// 件数の多い絵文字から順に枠を割り当てる
	for (const emoji of input.stats.emojis) {
		const all = grouped.get(emoji.type);
		if (all == null) continue;
		const sorted = [...all.values()].sort((a, b) => b.lastReactedAt.localeCompare(a.lastReactedAt));
		noteTotals[emoji.type] = sorted.length;

		const take = Math.max(0, Math.min(sorted.length, MAX_NOTES_PER_EMOJI, budget));
		if (take < sorted.length) truncated = true;
		if (take > 0) {
			notes[emoji.type] = sorted.slice(0, take);
			budget -= take;
		}
	}

	return {
		id: reportKey(input.origin, input.targets),
		savedAt: input.savedAt ?? new Date().toISOString(),
		origin: input.origin,
		instanceName: input.instanceName,
		targets: input.targets,
		stats: input.stats,
		notes,
		noteTotals,
		notesTruncated: truncated,
	};
}
