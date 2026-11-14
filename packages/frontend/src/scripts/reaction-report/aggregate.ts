/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { emojiSlug, parseReactionType } from './emoji-type.js';
import type { EmojiStat, ReportStats, TargetUser, UserSummary } from './types.js';

export interface RawReaction {
	id: string;
	type: string;
	createdAt: string;
	userId: string;
}

const collator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });

function summarizeUsers(users: TargetUser[], counts: Map<string, number>): UserSummary[] {
	return users.map((u) => ({
		id: u.id,
		username: u.username,
		name: u.name ?? u.username,
		host: u.host,
		count: counts.get(u.username) ?? 0,
	})).sort((a, b) => b.count - a.count || collator.compare(a.username, b.username));
}

export interface AggregateInput {
	origin: string;
	instanceName: string | null;
	users: TargetUser[];
	reactions: RawReaction[];
	generatedAt?: string;
}

/** 絵文字×ユーザーの集計 */
export function aggregate(input: AggregateInput): ReportStats {
	const byUserId = new Map(input.users.map((u) => [u.id, u]));
	const stats = new Map<string, EmojiStat>();
	const userCounts = new Map<string, number>();

	for (const r of input.reactions) {
		const user = byUserId.get(r.userId);
		const username = user?.username ?? r.userId;

		let stat = stats.get(r.type);
		if (stat == null) {
			const parsed = parseReactionType(r.type);
			stat = {
				type: r.type,
				slug: emojiSlug(r.type),
				kind: parsed.kind,
				name: parsed.name,
				host: parsed.host,
				count: 0,
				byUser: {},
			};
			stats.set(r.type, stat);
		}

		stat.count += 1;
		stat.byUser[username] = (stat.byUser[username] ?? 0) + 1;
		userCounts.set(username, (userCounts.get(username) ?? 0) + 1);
	}

	const emojis = [...stats.values()].sort((a, b) => b.count - a.count || collator.compare(a.name, b.name));
	const total = emojis.reduce((sum, e) => sum + e.count, 0);

	return {
		generatedAt: input.generatedAt ?? new Date().toISOString(),
		origin: input.origin,
		instanceName: input.instanceName,
		totals: { reactions: total, distinct: emojis.length, users: input.users.length },
		users: summarizeUsers(input.users, userCounts),
		emojis,
	};
}
