/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { ParsedReaction } from './types.js';

const CUSTOM_RE = /^:([^:@\s]+)(?:@([^:\s]+))?:$/u;
const UNSAFE = /[/\\:*?"<>|#\u0000-\u001f]/u;

/**
 * リアクション種別を分解する。
 * - `:name:` / `:name@.:` → ローカルのカスタム絵文字
 * - `:name@host:` → リモートのカスタム絵文字
 * - それ以外は Unicode 絵文字として扱う（ZWJ 連結や異体字セレクタもそのまま）
 */
export function parseReactionType(type: string): ParsedReaction {
	const m = CUSTOM_RE.exec(type);
	if (m == null) {
		return { kind: 'unicode', name: type, host: null };
	}
	const host = m[2] == null || m[2] === '.' ? null : m[2];
	return { kind: 'custom', name: m[1]!, host };
}

export function reactionLabel(type: string): string {
	const parsed = parseReactionType(type);
	if (parsed.kind === 'unicode') return parsed.name;
	return parsed.host == null ? `:${parsed.name}:` : `:${parsed.name}@${parsed.host}:`;
}

/** ブラウザでも動く簡易ハッシュ（FNV-1a を2系統） */
function shortHash(input: string): string {
	let h1 = 0x811c9dc5;
	let h2 = 0x01234567;
	for (const ch of input) {
		const c = ch.codePointAt(0) ?? 0;
		h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
		h2 = Math.imul(h2 ^ (c + 0x9e3779b9), 0x85ebca6b) >>> 0;
	}
	return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`.slice(0, 10);
}

/** 詳細ビューの識別子（URL には出さず、状態のキーとしてだけ使う） */
export function emojiSlug(type: string): string {
	const parsed = parseReactionType(type);
	if (parsed.kind === 'unicode') {
		return `u-${[...parsed.name].map((c) => (c.codePointAt(0) ?? 0).toString(16)).join('-')}`;
	}
	const base = parsed.host == null ? parsed.name : `${parsed.name}@${parsed.host}`;
	const usable = base.length > 0 && base.length <= 120 && !UNSAFE.test(base) && base !== '.' && base !== '..' && !base.startsWith('.') && !base.includes('..');
	if (!usable) return `e-${shortHash(type)}`;
	return /^u-[0-9a-f-]+$/u.test(base) ? `c-${base}` : base;
}
