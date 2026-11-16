/*
 * Follow User, a Vencord plugin
 * Copyright (c) 2026 cegged <https://github.com/cegged> (Discord: @c3g, ID 453743721402466317)
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { addServerListElement, removeServerListElement, ServerListRenderPosition } from "@api/ServerList";
import { migratePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Link } from "@components/Link";
import { Paragraph } from "@components/Paragraph";
import definePlugin from "@utils/types";
import type { User, VoiceState } from "@vencord/discord-types";
import { ChannelStore, Menu, SelectedChannelStore, UserStore } from "@webpack/common";

import { autoFollow, getChannelId, getMemberCount, isUserLimited, notifyJoined, setPaused, toggleFollow } from "./follow";
import { FollowIndicator } from "./FollowIndicator";
import { FollowIcon, FollowingIcon } from "./icons";
import { AUTHOR, settings } from "./settings";

const UserContext: NavContextMenuPatchCallback = (children, { user }: { user?: User; }) => {
    if (!user || user.id === UserStore.getCurrentUser().id) return;

    const isFollowed = settings.store.followUserId === user.id;
    const icon = isFollowed ? FollowingIcon : FollowIcon;

    children.splice(-1, 0, (
        <Menu.MenuGroup>
            <Menu.MenuItem
                id="vc-follow-user"
                label={isFollowed ? "Unfollow User" : "Follow User"}
                action={() => toggleFollow(user.id)}
                icon={icon}
                leadingAccessory={{ type: "icon", icon }}
            />
        </Menu.MenuGroup>
    ));
};

migratePluginSettings("Follow User", "FollowUser");

export default definePlugin({
    name: "Follow User",
    description: "Adds a follow option in the user context menu to always be in the same VC as them",
    authors: [AUTHOR],

    settings,

    settingsAboutComponent: () => (
        <Paragraph>
            GitHub: <Link href="https://github.com/cegged">cegged</Link>
        </Paragraph>
    ),

    dependencies: ["ServerListAPI"],

    renderIndicator: ErrorBoundary.wrap(FollowIndicator, { noop: true }),

    start() {
        addServerListElement(ServerListRenderPosition.Above, this.renderIndicator);
    },

    stop() {
        removeServerListElement(ServerListRenderPosition.Above, this.renderIndicator);
    },

    contextMenus: {
        "user-context": UserContext
    },

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            const { followUserId, onlyManualTrigger } = settings.store;
            if (!followUserId) return;

            const myId = UserStore.getCurrentUser().id;

            for (const { userId, channelId, oldChannelId } of voiceStates) {
                if (channelId === oldChannelId) continue;

                const isMe = userId === myId;

                if (isMe && !onlyManualTrigger) {
                    const followedChannelId = getChannelId(followUserId);

                    if (!channelId && oldChannelId && oldChannelId === followedChannelId) {
                        setPaused(true);
                        continue;
                    }

                    if (channelId && channelId === followedChannelId) {
                        setPaused(false);
                    }
                }

                if (onlyManualTrigger || settings.store.paused) {
                    if (userId === followUserId && channelId) notifyJoined(channelId);
                    continue;
                }

                if (settings.store.autoMoveBack && isMe && channelId && oldChannelId) {
                    if (channelId !== getChannelId(followUserId)) autoFollow();
                    continue;
                }

                if (settings.store.channelFull && !isMe && !channelId && oldChannelId && oldChannelId !== SelectedChannelStore.getVoiceChannelId()) {
                    const channel = ChannelStore.getChannel(oldChannelId);
                    const justFreedUp = channel && isUserLimited(channel) && getMemberCount(oldChannelId) === channel.userLimit - 1;

                    if (justFreedUp && getChannelId(followUserId) === oldChannelId) {
                        autoFollow(oldChannelId);
                        continue;
                    }
                }

                if (userId !== followUserId) continue;

                if (channelId) {
                    autoFollow(channelId);
                } else if (oldChannelId) {
                    autoFollow(null);
                }
            }
        },
    },
});
