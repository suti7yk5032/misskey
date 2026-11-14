/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { ReportSnapshot, ReportSummary } from './snapshot.js';

/**
 * 集計結果のブラウザ内キャッシュ（IndexedDB）。
 * ノート込みだと localStorage の容量に収まらないので IndexedDB を使う。
 * 使えない環境（プライベートモード等）では静かに諦める。
 */

const DB_NAME = 'reaction-report';
const DB_VERSION = 1;
const STORE_REPORTS = 'reports';
const STORE_SUMMARIES = 'summaries';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
	if (dbPromise != null) return dbPromise;

	dbPromise = new Promise<IDBDatabase | null>((resolve) => {
		if (typeof indexedDB === 'undefined') {
			resolve(null);
			return;
		}

		const req = indexedDB.open(DB_NAME, DB_VERSION);

		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE_REPORTS)) {
				db.createObjectStore(STORE_REPORTS, { keyPath: 'id' });
			}
			if (!db.objectStoreNames.contains(STORE_SUMMARIES)) {
				db.createObjectStore(STORE_SUMMARIES, { keyPath: 'id' });
			}
		};

		req.onsuccess = () => resolve(req.result);
		req.onerror = () => resolve(null);
		req.onblocked = () => resolve(null);
	});

	return dbPromise;
}

function tx<T>(db: IDBDatabase, stores: string[], mode: IDBTransactionMode, run: (t: IDBTransaction) => IDBRequest<T> | null): Promise<T | null> {
	return new Promise((resolve) => {
		let request: IDBRequest<T> | null = null;
		try {
			const t = db.transaction(stores, mode);
			request = run(t);
			t.oncomplete = () => resolve(request == null ? null : request.result);
			t.onerror = () => resolve(null);
			t.onabort = () => resolve(null);
		} catch {
			resolve(null);
		}
	});
}

export async function isCacheAvailable(): Promise<boolean> {
	return (await openDb()) != null;
}

export async function listReports(): Promise<ReportSummary[]> {
	const db = await openDb();
	if (db == null) return [];
	const all = await tx<ReportSummary[]>(db, [STORE_SUMMARIES], 'readonly', (t) => t.objectStore(STORE_SUMMARIES).getAll());
	if (all == null) return [];
	return all.slice().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function getReport(id: string): Promise<ReportSnapshot | null> {
	const db = await openDb();
	if (db == null) return null;
	return (await tx<ReportSnapshot | undefined>(db, [STORE_REPORTS], 'readonly', (t) => t.objectStore(STORE_REPORTS).get(id))) ?? null;
}

export async function saveReport(snapshot: ReportSnapshot, summary: ReportSummary): Promise<boolean> {
	const db = await openDb();
	if (db == null) return false;

	// Vue の reactive proxy は structuredClone できない（DataCloneError）ため、
	// IndexedDB に入れる前に JSON 経由で素のオブジェクトへ落とす
	let plain: { snapshot: ReportSnapshot; summary: ReportSummary };
	try {
		plain = JSON.parse(JSON.stringify({ snapshot, summary })) as { snapshot: ReportSnapshot; summary: ReportSummary };
	} catch (err) {
		console.warn('[reaction-report] キャッシュのシリアライズに失敗しました', err);
		return false;
	}

	const ok = await new Promise<boolean>((resolve) => {
		try {
			const t = db.transaction([STORE_REPORTS, STORE_SUMMARIES], 'readwrite');
			t.objectStore(STORE_REPORTS).put(plain.snapshot);
			t.objectStore(STORE_SUMMARIES).put(plain.summary);
			t.oncomplete = () => resolve(true);
			t.onerror = () => {
				console.warn('[reaction-report] キャッシュの保存に失敗しました', t.error);
				resolve(false);
			};
			t.onabort = () => {
				console.warn('[reaction-report] キャッシュの保存が中断されました', t.error);
				resolve(false);
			};
		} catch (err) {
			console.warn('[reaction-report] キャッシュの保存に失敗しました', err);
			resolve(false);
		}
	});
	return ok;
}

export async function deleteReport(id: string): Promise<void> {
	const db = await openDb();
	if (db == null) return;
	await new Promise<void>((resolve) => {
		try {
			const t = db.transaction([STORE_REPORTS, STORE_SUMMARIES], 'readwrite');
			t.objectStore(STORE_REPORTS).delete(id);
			t.objectStore(STORE_SUMMARIES).delete(id);
			t.oncomplete = () => resolve();
			t.onerror = () => resolve();
			t.onabort = () => resolve();
		} catch {
			resolve();
		}
	});
}
