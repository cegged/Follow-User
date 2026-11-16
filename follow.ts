/*
 * Follow User, a Vencord plugin
 * Copyright (c) 2026 cegged <https://github.com/cegged> (Discord: @c3g, ID 453743721402466317)
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotification } from "@api/Notifications";
import type { Channel } from "@vencord/discord-types";
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

export function getDisplayName(userId: string) {
    const user = UserStore.getUser(userId);
    return user?.globalName || user?.username || "user";
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

// Whether you are in the same voice channel as the user
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
    if (!settings.store.followUserId) return;

    const myChannelId = SelectedChannelStore.getVoiceChannelId();

    if (!userChannelId) {
        if (!myChannelId) {
            showToast({ text: "User not in voice (or in a server you're not in)", variant: "critical" });
        } else if (settings.store.followLeave) {
            ChannelActions.disconnect();
            showToast({ text: "Followed user left, disconnected", variant: "success" });
        } else {
            showToast({ text: "Followed user left, but not following disconnect", variant: "critical" });
        }
        return;
    }

    if (userChannelId === myChannelId) {
        showToast({ text: "You are already in the same channel", variant: "critical" });
        return;
    }

    const channel = ChannelStore.getChannel(userChannelId);
    if (!channel) return;

    if (!channel.isPrivate() && !PermissionStore.can(PermissionsBits.CONNECT, channel)) {
        showToast({ text: "Insufficient permissions to enter in the voice channel", variant: "critical" });
        return;
    }

    if (isUserLimited(channel) && getMemberCount(userChannelId) >= channel.userLimit) {
        showToast({ text: "Channel is full", variant: "critical" });
        return;
    }

    ChannelActions.selectVoiceChannel(userChannelId);
    showToast({ text: "Followed user into a new voice channel", variant: "success" });
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

    showNotification({
        title: "Follow User",
        body: `${getDisplayName(followUserId)} joined ${getVoiceLocation(followUserId) ?? "a voice channel"}. Click to join.`,
        icon: UserStore.getUser(followUserId)?.getAvatarURL(undefined, 128),
        onClick: joinNow
    });
}

function follow(userId: string) {
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
