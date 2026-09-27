<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModalWindow
	ref="dialogEl"
	:withOkButton="true"
	:okButtonDisabled="tab === 'user' ? selected == null : selectedList == null"
	@click="cancel()"
	@close="cancel()"
	@ok="ok()"
	@closed="emit('closed')"
>
	<template #header>{{ i18n.ts.selectUser }}</template>
	<div>
		<MkTabs
			v-if="props.includeUserLists"
			v-model:tab="tab"
			:tabs="[
				{ key: 'user', title: i18n.ts.user, icon: 'ti ti-user' },
				{ key: 'list', title: i18n.ts.userList, icon: 'ti ti-list' },
			]"
		/>
		<div v-if="tab === 'user'">
			<div :class="$style.form">
				<MkInput v-if="computedLocalOnly" v-model="username" :autofocus="true" @update:modelValue="search">
					<template #label>{{ i18n.ts.username }}</template>
					<template #prefix>@</template>
				</MkInput>
				<FormSplit v-else :minWidth="170">
					<MkInput v-model="username" :autofocus="true" @update:modelValue="search">
						<template #label>{{ i18n.ts.username }}</template>
						<template #prefix>@</template>
					</MkInput>
					<MkInput v-model="host" :datalist="[hostname]" @update:modelValue="search">
						<template #label>{{ i18n.ts.host }}</template>
						<template #prefix>@</template>
					</MkInput>
				</FormSplit>
			</div>
			<div v-if="username != '' || host != ''" :class="[$style.result, { [$style.hit]: users.length > 0 }]">
				<div v-if="users.length > 0" :class="$style.users">
					<div v-for="user in users" :key="user.id" class="_button" :class="[$style.user, { [$style.selected]: selected && selected.id === user.id }]" @click="selected = user" @dblclick="ok()">
						<MkAvatar :user="user" :class="$style.avatar" indicator/>
						<div :class="$style.userBody">
							<MkUserName :user="user" :class="$style.userName"/>
							<MkAcct :user="user" :class="$style.userAcct"/>
						</div>
					</div>
				</div>
				<div v-else :class="$style.empty">
					<span>{{ i18n.ts.noUsers }}</span>
				</div>
			</div>
			<div v-if="username == '' && host == ''" :class="$style.recent">
				<div :class="$style.users">
					<div v-for="user in recentUsers" :key="user.id" class="_button" :class="[$style.user, { [$style.selected]: selected && selected.id === user.id }]" @click="selected = user" @dblclick="ok()">
						<MkAvatar :user="user" :class="$style.avatar" indicator/>
						<div :class="$style.userBody">
							<MkUserName :user="user" :class="$style.userName"/>
							<MkAcct :user="user" :class="$style.userAcct"/>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div v-else :class="$style.lists">
			<div
				v-for="list in userLists"
				:key="list.id"
				class="_button"
				role="button"
				tabindex="0"
				:class="[$style.list, { [$style.selected]: selectedList?.id === list.id }]"
				@click="selectedList = list"
				@dblclick="ok()"
				@keydown.enter="selectedList = list"
				@keydown.space.prevent="selectedList = list"
			>
				<div :class="$style.listName">{{ list.name }}</div>
				<div :class="$style.listUsers">
					<MkAcct v-for="user in list.users" :key="user.id" :user="user" :class="$style.listUser"/>
				</div>
			</div>
		</div>
	</div>
</MkModalWindow>
</template>

<script lang="ts" setup>
import { onMounted, ref, computed, useTemplateRef } from 'vue';
import * as Misskey from 'misskey-js';
import { hostname } from '@@/js/config.js';
import MkInput from '@/components/MkInput.vue';
import FormSplit from '@/components/form/split.vue';
import MkModalWindow from '@/components/MkModalWindow.vue';
import MkTabs from '@/components/MkTabs.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { store } from '@/store.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/i.js';
import { instance } from '@/instance.js';

const emit = defineEmits<{
	(ev: 'ok', selected: Misskey.entities.UserDetailed | string[]): void;
	(ev: 'cancel'): void;
	(ev: 'closed'): void;
}>();

const props = withDefaults(defineProps<{
	includeSelf?: boolean;
	localOnly?: boolean;
	includeUserLists?: boolean;
}>(), {
	includeSelf: false,
	localOnly: false,
	includeUserLists: false,
});

const computedLocalOnly = computed(() => props.localOnly || instance.federation === 'none');

const username = ref('');
const host = ref('');
const users = ref<Misskey.entities.UserLite[]>([]);
const recentUsers = ref<Misskey.entities.UserDetailed[]>([]);
const selected = ref<Misskey.entities.UserLite | null>(null);
const selectedList = ref<(Misskey.entities.UserList & { users: Misskey.entities.UserDetailed[] }) | null>(null);
const userLists = ref<(Misskey.entities.UserList & { users: Misskey.entities.UserDetailed[] })[]>([]);
const tab = ref<'user' | 'list'>('user');
const dialogEl = useTemplateRef('dialogEl');

function search() {
	if (username.value === '' && host.value === '') {
		users.value = [];
		return;
	}
	misskeyApi('users/search-by-username-and-host', {
		username: username.value,
		host: computedLocalOnly.value ? '.' : host.value,
		limit: 10,
		detail: false,
	}).then(_users => {
		users.value = _users.filter((u) => {
			if (props.includeSelf) {
				return true;
			} else {
				return u.id !== $i?.id;
			}
		});
	});
}

async function ok() {
	if (tab.value === 'list') {
		if (selectedList.value == null) return;
		emit('ok', selectedList.value.users.map(user => Misskey.acct.toString(user)));
		dialogEl.value?.close();
		return;
	}

	if (selected.value == null) return;

	const user = await misskeyApi('users/show', {
		userId: selected.value.id,
	});
	emit('ok', user);

	dialogEl.value?.close();

	// 最近使ったユーザー更新
	let recents = store.s.recentlyUsedUsers;
	recents = recents.filter(x => x !== selected.value?.id);
	recents.unshift(selected.value.id);
	store.set('recentlyUsedUsers', recents.splice(0, 16));
}

function cancel() {
	emit('cancel');
	dialogEl.value?.close();
}

onMounted(() => {
	if (props.includeUserLists) {
		misskeyApi('users/lists/list').then(lists => {
			Promise.all(lists.map(async list => ({
				...list,
				users: await misskeyApi('users/show', { userIds: list.userIds ?? [] }),
			}))).then(listsWithUsers => {
				userLists.value = listsWithUsers;
			});
		});
	}

	misskeyApi('users/show', {
		userIds: store.s.recentlyUsedUsers,
	}).then(foundUsers => {
		let _users = foundUsers;
		_users = _users.filter((u) => {
			if (computedLocalOnly.value) {
				return u.host == null;
			} else {
				return true;
			}
		});
		_users = _users.filter((u) => {
			if (props.includeSelf) {
				return true;
			} else {
				return u.id !== $i?.id;
			}
		});
		recentUsers.value = _users;
	});
});
</script>

<style lang="scss" module>

.form {
	padding: calc(var(--root-margin) / 2) var(--root-margin);
}

.result,
.recent {
	display: flex;
	flex-direction: column;
	overflow: auto;
	height: 100%;

	&.result.hit {
		padding: 0;
	}

	&.recent {
		padding: 0;
	}
}

.users {
	flex: 1;
	overflow: auto;
	padding: 8px 0;
}

.user {
	display: flex;
	align-items: center;
	padding: 8px var(--root-margin);
	font-size: 14px;

	&:hover {
		background: light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.05));
	}

	&.selected {
		background: var(--MI_THEME-accent);
		color: #fff;
	}
}

.userBody {
	padding: 0 8px;
	min-width: 0;
}

.avatar {
	width: 45px;
	height: 45px;
}

.userName {
	display: block;
	font-weight: bold;
}

.userAcct {
	opacity: 0.5;
}

.empty {
	opacity: 0.7;
	text-align: center;
	padding: 16px;
}

.lists {
	display: flex;
	flex-direction: column;
	overflow: auto;
	height: 100%;
	padding: 8px 0;
}

.list {
	padding: 12px var(--root-margin);

	&:hover {
		background: color-mix(in srgb, var(--MI_THEME-panel), var(--MI_THEME-fg) 5%);
	}

	&.selected {
		background: var(--MI_THEME-accent);
		color: var(--MI_THEME-fgOnAccent);
	}
}

.listName {
	font-weight: bold;
}

.listUsers {
	display: flex;
	flex-wrap: wrap;
	gap: 0 12px;
	opacity: 0.7;
}

.listUser {
	font-size: 14px;
}
</style>
