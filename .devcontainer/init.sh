#!/bin/bash

set -xe

sudo apt-get update
sudo apt-get -y install libgtk2.0-0 libgtk-3-0 libgbm-dev libnotify-dev libnss3 libxss1 libasound2 libxtst6 xauth xvfb

if grep -q "^\s*0\s*0.*" /proc/self/uid_map; then
	sudo chown node node_modules
else
	printf "Rootless mode detected.\n"
	sudo chown -R node /workspace/* /workspace/.[^.]* || true
	sudo chown node /workspace
fi

git config --global --add safe.directory /workspace
git submodule update --init
pnpm config set store-dir /home/node/.local/share/pnpm/store
pnpm install --frozen-lockfile
cp .devcontainer/devcontainer.yml .config/default.yml
pnpm build
pnpm migrate
pnpm exec cypress install
