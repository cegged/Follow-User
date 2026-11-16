/*
 * Follow User, a Vencord plugin
 * Copyright (c) 2026 cegged <https://github.com/cegged> (Discord: @c3g, ID 453743721402466317)
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotification } from "@api/Notifications";
import type { Channel, User } from "@vencord/discord-types";
import { findByPropsLazy } from "@webpack";
import {
    ChannelStore,
    GuildStore,
    PermissionsBits,
    PermissionStore,
    SelectedChannelStore,
    showToast,
    UserStore,
    VoiceStateStore
} from "@webpack/common";

import { settings } from "./settings";

const ChannelActions: {
    disconnect: () => void;
    selectVoiceChannel: (channelId: string) => void;
} = findByPropsLazy("disconnect", "selectVoiceChannel");

const AUTO_JOIN_LIMIT = 5;
const AUTO_JOIN_WINDOW = 30_000;
const autoJoins: number[] = [];

const NOTIFY_COOLDOWN = 60_000;
const notifiedAt = new Map<string, number>();

function resetHistory() {
    autoJoins.length = 0;
    notifiedAt.clear();
}

export function nameOf(user?: User | null) {
    return user?.globalName || user?.username || "user";
}

export function getDisplayName(userId: string) {
    return nameOf(UserStore.getUser(userId));
}

export function getChannelId(userId: string) {
    if (!userId) return null;

    return VoiceStateStore.getVoiceStateForUser(userId)?.channelId ?? null;
}

export function getVoiceLocation(userId: string) {
    const channelId = getChannelId(userId);
    if (!channelId) return null;

    const channel = ChannelStore.getChannel(channelId);
    if (!channel) return "a voice channel";
    if (channel.isPrivate()) return "a private call";

    const guild = GuildStore.getGuild(channel.guild_id);
    return guild ? `${channel.name} (${guild.name})` : channel.name;
}

export function isTogether(userId: string) {
    const channelId = getChannelId(userId);
    return channelId != null && channelId === SelectedChannelStore.getVoiceChannelId();
}

export function getMemberCount(channelId: string) {
    return Object.keys(VoiceStateStore.getVoiceStatesForChannel(channelId) ?? {}).length;
}

export function isUserLimited(channel: Channel) {
    return channel.userLimit !== 0 && !PermissionStore.can(PermissionsBits.MOVE_MEMBERS, channel);
}

export function triggerFollow(userChannelId: string | null = getChannelId(settings.store.followUserId)) {
    const { followUserId } = settings.store;
    if (!followUserId) return false;

    const name = getDisplayName(followUserId);
    const myChannelId = SelectedChannelStore.getVoiceChannelId();

    if (!userChannelId) {
        if (!myChannelId) {
            showToast({ text: `${name} isn't in a voice channel you can see`, variant: "critical" });
        } else if (settings.store.followLeave) {
            ChannelActions.disconnect();
            showToast({ text: `${name} left voice, so you left too`, variant: "success" });
        } else {
            showToast({ text: `${name} left voice` });
        }
        return false;
    }

    if (userChannelId === myChannelId) {
        showToast({ text: `You're already with ${name}` });
        return false;
    }

    const channel = ChannelStore.getChannel(userChannelId);
    if (!channel) return false;

    if (!channel.isPrivate() && !PermissionStore.can(PermissionsBits.CONNECT, channel)) {
        showToast({ text: `You don't have permission to join ${name}'s channel`, variant: "critical" });
        return false;
    }

    if (isUserLimited(channel) && getMemberCount(userChannelId) >= channel.userLimit) {
        const waits = settings.store.channelFull && !settings.store.onlyManualTrigger;
        showToast({ text: `${name}'s channel is full${waits ? ". You'll join when a spot opens" : ""}`, variant: "critical" });
        return false;
    }

    ChannelActions.selectVoiceChannel(userChannelId);
    showToast({ text: `Joined ${name} in ${channel.isPrivate() ? "a private call" : channel.name}`, variant: "success" });
    return true;
}

export function autoFollow(userChannelId?: string | null) {
    const now = Date.now();
    while (autoJoins.length && now - autoJoins[0] > AUTO_JOIN_WINDOW) autoJoins.shift();

    if (autoJoins.length >= AUTO_JOIN_LIMIT) {
        autoJoins.length = 0;
        settings.store.paused = true;
        showToast({
            text: `Paused following ${getDisplayName(settings.store.followUserId)}: you were moved too often. Click their picture to resume`,
            variant: "critical"
        });
        return;
    }

    if (triggerFollow(userChannelId)) autoJoins.push(now);
}

export function setPaused(paused: boolean) {
    if (settings.store.paused === paused) return;

    settings.store.paused = paused;
    showToast({ text: `${paused ? "Paused" : "Resumed"} following ${getDisplayName(settings.store.followUserId)}` });
}

export function joinNow() {
    settings.store.paused = false;
    triggerFollow();
}

export function notifyJoined(channelId: string) {
    const { followUserId } = settings.store;
    if (!settings.store.notifyOnJoin || channelId === SelectedChannelStore.getVoiceChannelId()) return;

    const now = Date.now();
    for (const [id, at] of notifiedAt) if (now - at > NOTIFY_COOLDOWN) notifiedAt.delete(id);
    if (notifiedAt.has(channelId)) return;
    notifiedAt.set(channelId, now);

    showNotification({
        title: "Follow User",
        body: `${getDisplayName(followUserId)} joined ${getVoiceLocation(followUserId) ?? "a voice channel"}. Click to join.`,
        icon: UserStore.getUser(followUserId)?.getAvatarURL(undefined, 128),
        onClick: joinNow
    });
}

function follow(userId: string) {
    resetHistory();
    settings.store.followUserId = userId;
    settings.store.paused = false;
    showToast({ text: `Now following ${getDisplayName(userId)}`, variant: "success" });

    const channelId = getChannelId(userId);
    if (settings.store.executeOnFollow && channelId && channelId !== SelectedChannelStore.getVoiceChannelId()) {
        triggerFollow(channelId);
    }
}

export function unfollow() {
    const { followUserId } = settings.store;
    if (!followUserId) return;

    resetHistory();
    settings.store.followUserId = "";
    settings.store.paused = false;
    showToast({ text: `Stopped following ${getDisplayName(followUserId)}` });
}

export function toggleFollow(userId: string) {
    if (settings.store.followUserId === userId) {
        unfollow();
    } else {
        follow(userId);
    }
}
