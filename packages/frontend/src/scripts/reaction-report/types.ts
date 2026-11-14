/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 集計結果の型（リアクション帳票） */

export type ReactionKind = 'custom' | 'unicode';

export interface ParsedReaction {
	kind: ReactionKind;
	name: string;
	host: string | null;
}

export interface TargetUser {
	id: string;
	username: string;
	name: string | null;
	host: string | null;
	avatarUrl?: string | null;
}

export interface UserSummary {
	id: string;
	username: string;
	name: string;
	host: string | null;
	count: number;
}

export interface EmojiStat {
	/** リアクション種別そのまま（:name@host: / 👍） */
	type: string;
	/** 詳細ビューの識別子 */
	slug: string;
	kind: ReactionKind;
	name: string;
	host: string | null;
	count: number;
	/** username -> 件数 */
	byUser: Record<string, number>;
}

export interface ReportStats {
	generatedAt: string;
	origin: string;
	instanceName: string | null;
	totals: { reactions: number; distinct: number; users: number };
	users: UserSummary[];
	emojis: EmojiStat[];
}

/** 詳細ビュー用（ノートは本体の Note をそのまま持つ） */
export interface NoteReactionEntry {
	noteId: string;
	/** リアクションした人 */
	reactors: { username: string; createdAt: string }[];
	lastReactedAt: string;
}
