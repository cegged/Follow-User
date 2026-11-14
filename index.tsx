/*
 * Follow User, a Vencord plugin
 * Copyright (c) 2026 cegged <https://github.com/cegged> (Discord: @c3g, ID 453743721402466317)
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { showNotification } from "@api/Notifications";
import { plugins } from "@api/PluginManager";
import { addServerListElement, removeServerListElement, ServerListRenderPosition } from "@api/ServerList";
import { definePluginSettings, migratePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { CogWheel } from "@components/Icons";
import { Link } from "@components/Link";
import { Paragraph } from "@components/Paragraph";
import { openPluginModal } from "@components/settings";
import { openUserProfile } from "@utils/discord";
import { classes } from "@utils/misc";
import { useAwaiter } from "@utils/react";
import definePlugin, { OptionType } from "@utils/types";
import type { Channel, User, VoiceState } from "@vencord/discord-types";
import { findByPropsLazy } from "@webpack";
import {
    ChannelStore,
    ContextMenuApi,
    GuildStore,
    Menu,
    PermissionsBits,
    PermissionStore,
    SelectedChannelStore,
    showToast,
    Tooltip,
    UserStore,
    UserUtils,
    useStateFromStores,
    VoiceStateStore
} from "@webpack/common";

const AUTHOR = { name: "cegged", id: 453743721402466317n };

const ChannelActions: {
    disconnect: () => void;
    selectVoiceChannel: (channelId: string) => void;
} = findByPropsLazy("disconnect", "selectVoiceChannel");

const WALKING_PERSON = "M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7";

interface IconProps {
    className?: string;
    height?: string | number;
    width?: string | number;
}

function FollowIcon({ className, height = 24, width = 24, following = false }: IconProps & { following?: boolean; }) {
    return (
        <svg
            className={classes(className, "vc-follow-user-icon")}
            role="img"
            width={width}
            height={height}
            viewBox="0 0 24 24"
            fill="currentColor"
        >
            <path d={WALKING_PERSON} transform="translate(-3.5 3.4) scale(.72)" opacity={following ? 1 : 0.45} />
            <path d={WALKING_PERSON} transform="translate(8.5 3.4) scale(.72)" />
        </svg>
    );
}

function FollowingIcon(props: IconProps) {
    return <FollowIcon {...props} following />;
}

function makeWalkerIcon(symbol: string) {
    return ({ className, height = 24, width = 24 }: IconProps) => (
        <svg className={className} role="img" width={width} height={height} viewBox="0 0 24 24" fill="currentColor">
            <path d={WALKING_PERSON} transform="translate(-4.3 2.4) scale(.8)" />
            <path d={symbol} />
        </svg>
    );
}

const JoinIcon = makeWalkerIcon("M15 3.5h5.5A1.5 1.5 0 0 1 22 5v14a1.5 1.5 0 0 1-1.5 1.5H15v-2h5v-13h-5z");
const PauseIcon = makeWalkerIcon("M14 7h2.6v10H14zM18.9 7h2.6v10h-2.6z");
const ResumeIcon = makeWalkerIcon("M14 6.5v11l8.5-5.5z");
const UnfollowIcon = makeWalkerIcon("M21.9 8.5 20.5 7.1 18 9.6l-2.5-2.5-1.4 1.4 2.5 2.5-2.5 2.5 1.4 1.4 2.5-2.5 2.5 2.5 1.4-1.4-2.5-2.5z");

export const settings = definePluginSettings({
    executeOnFollow: {
        type: OptionType.BOOLEAN,
        description: "Join the user's voice channel right away when you start following them",
        default: true
    },
    onlyManualTrigger: {
        type: OptionType.BOOLEAN,
        description: "Only follow when clicking the indicator in the server list",
        default: false
    },
    followLeave: {
        type: OptionType.BOOLEAN,
        description: "Also leave when the followed user leaves",
        default: false
    },
    autoMoveBack: {
        type: OptionType.BOOLEAN,
        description: "Automatically move back to the followed user's voice channel when you get moved",
        default: false
    },
    channelFull: {
        type: OptionType.BOOLEAN,
        description: "Join the followed user's voice channel once it is no longer full",
        default: true
    },
    notifyOnJoin: {
        type: OptionType.BOOLEAN,
        description: "Show a notification when the followed user joins a voice channel while following is paused or manual",
        default: true
    },
    followUserId: {
        type: OptionType.STRING,
        description: "Followed User ID",
        hidden: true,
        default: ""
    },
    paused: {
        type: OptionType.BOOLEAN,
        description: "Whether following is paused",
        hidden: true,
        default: false
    }
});

function getDisplayName(userId: string) {
    const user = UserStore.getUser(userId);
    return user?.globalName || user?.username || "user";
}

function getChannelId(userId: string) {
    if (!userId) return null;

    return VoiceStateStore.getVoiceStateForUser(userId)?.channelId ?? null;
}

function getVoiceLocation(userId: string) {
    const channelId = getChannelId(userId);
    if (!channelId) return null;

    const channel = ChannelStore.getChannel(channelId);
    if (!channel) return "a voice channel";
    if (channel.isPrivate()) return "a private call";

    const guild = GuildStore.getGuild(channel.guild_id);
    return guild ? `${channel.name} (${guild.name})` : channel.name;
}

function getMemberCount(channelId: string) {
    return Object.keys(VoiceStateStore.getVoiceStatesForChannel(channelId) ?? {}).length;
}

function isUserLimited(channel: Channel) {
    return channel.userLimit !== 0 && !PermissionStore.can(PermissionsBits.MOVE_MEMBERS, channel);
}

function triggerFollow(userChannelId: string | null = getChannelId(settings.store.followUserId)) {
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

function setPaused(paused: boolean) {
    if (settings.store.paused === paused) return;

    settings.store.paused = paused;
    showToast({ text: `${paused ? "Paused" : "Resumed"} following ${getDisplayName(settings.store.followUserId)}` });
}

function joinNow() {
    settings.store.paused = false;
    triggerFollow();
}

function notifyJoined(channelId: string) {
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

function unfollow() {
    const { followUserId } = settings.store;
    if (!followUserId) return;

    settings.store.followUserId = "";
    settings.store.paused = false;
    showToast({ text: `Stopped following ${getDisplayName(followUserId)}` });
}

function toggleFollow(userId: string) {
    if (settings.store.followUserId === userId) {
        unfollow();
    } else {
        follow(userId);
    }
}

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

function IndicatorContextMenu() {
    const { paused, followUserId } = settings.store;
    const followedChannelId = getChannelId(followUserId);
    const isTogether = followedChannelId != null && followedChannelId === SelectedChannelStore.getVoiceChannelId();
    const authorId = AUTHOR.id.toString();
    const [author] = useAwaiter(() => UserUtils.getUser(authorId).catch(() => null), {
        fallbackValue: UserStore.getUser(authorId) ?? null
    });

    return (
        <Menu.Menu
            navId="vc-follow-user-indicator"
            onClose={ContextMenuApi.closeContextMenu}
            aria-label="Follow User"
        >
            {!isTogether && (
                <Menu.MenuItem
                    id="vc-follow-user-join"
                    label="Join Now"
                    leadingAccessory={{ type: "icon", icon: JoinIcon }}
                    action={joinNow}
                />
            )}
            <Menu.MenuItem
                id="vc-follow-user-pause"
                label={paused ? "Resume Following" : "Pause Following"}
                leadingAccessory={{ type: "icon", icon: paused ? ResumeIcon : PauseIcon }}
                action={() => setPaused(!paused)}
            />
            <Menu.MenuItem
                id="vc-follow-user-unfollow"
                label="Unfollow"
                color="danger"
                leadingAccessory={{ type: "icon", icon: UnfollowIcon }}
                action={unfollow}
            />
            <Menu.MenuSeparator />
            <Menu.MenuItem
                id="vc-follow-user-settings"
                label="Settings"
                leadingAccessory={{ type: "icon", icon: CogWheel }}
                action={() => openPluginModal(plugins["Follow User"])}
            />
            <Menu.MenuSeparator />
            <Menu.MenuItem
                id="vc-follow-user-author"
                label="Made by @c3g"
                leadingAccessory={author ? { type: "avatar", src: author.getAvatarURL(undefined, 32) } as any : undefined}
                action={() => openUserProfile(authorId)}
            />
        </Menu.Menu>
    );
}

function FollowIndicator() {
    const { followUserId, paused } = settings.use(["followUserId", "paused"]);
    const user = useStateFromStores([UserStore], () => UserStore.getUser(followUserId));
    const location = useStateFromStores([VoiceStateStore, ChannelStore, GuildStore], () => getVoiceLocation(followUserId));

    if (!followUserId) return null;

    const tooltip = (
        <div>
            <div>{paused ? "Paused following" : "Following"} {getDisplayName(followUserId)}</div>
            <div className="vc-follow-user-tooltip-detail">{location ? `In ${location}` : "Not in a voice channel you can see"}</div>
            <div className="vc-follow-user-tooltip-detail">Click to join, right-click for options</div>
        </div>
    );

    return (
        <div className="vc-follow-user-container">
            <Tooltip text={tooltip} position="right">
                {tooltipProps => (
                    <div
                        {...tooltipProps}
                        className={classes("vc-follow-user-indicator", paused && "vc-follow-user-paused")}
                        role="button"
                        onClick={joinNow}
                        onContextMenu={e => ContextMenuApi.openContextMenu(e, IndicatorContextMenu)}
                    >
                        {user
                            ? <img className="vc-follow-user-avatar" src={user.getAvatarURL(undefined, 96)} alt="" />
                            : <div className="vc-follow-user-avatar"><FollowIcon following /></div>
                        }
                        <div className={classes("vc-follow-user-badge", location && !paused && "vc-follow-user-badge-active")}>
                            <FollowIcon following width={14} height={14} />
                        </div>
                    </div>
                )}
            </Tooltip>
        </div>
    );
}

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
                    triggerFollow();
                    continue;
                }

                if (settings.store.channelFull && !isMe && !channelId && oldChannelId && oldChannelId !== SelectedChannelStore.getVoiceChannelId()) {
                    const channel = ChannelStore.getChannel(oldChannelId);
                    const justFreedUp = channel && isUserLimited(channel) && getMemberCount(oldChannelId) === channel.userLimit - 1;

                    if (justFreedUp && getChannelId(followUserId) === oldChannelId) {
                        triggerFollow(oldChannelId);
                        continue;
                    }
                }

                if (userId !== followUserId) continue;

                if (channelId) {
                    triggerFollow(channelId);
                } else if (oldChannelId) {
                    triggerFollow(null);
                }
            }
        },
    },
});
