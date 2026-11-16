/*
 * Follow User, a Vencord plugin
 * Copyright (c) 2026 cegged <https://github.com/cegged> (Discord: @c3g, ID 453743721402466317)
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import {
    ChannelStore,
    GuildStore,
    Popout,
    Tooltip,
    useRef,
    UserStore,
    useState,
    useStateFromStores,
    VoiceStateStore
} from "@webpack/common";

import { getDisplayName, getVoiceLocation, joinNow } from "./follow";
import { cl, FollowPanel, glassProps } from "./FollowPanel";
import { FollowIcon, PauseBarsIcon } from "./icons";
import { settings } from "./settings";

const SafeFollowPanel = ErrorBoundary.wrap(FollowPanel, { noop: false });

type BadgeState = "active" | "idle" | "paused";

function StatusBadge({ state }: { state: BadgeState; }) {
    return (
        <div className={cl("badge", { "badge-active": state === "active" })}>
            {state === "paused"
                ? <PauseBarsIcon width={10} height={10} />
                : <FollowIcon following width={14} height={14} />}
        </div>
    );
}

interface FollowTooltipProps {
    name: string;
    paused: boolean;
    location: string | null;
    transparency: number;
}

function FollowTooltip({ name, paused, location, transparency }: FollowTooltipProps) {
    return (
        <div {...glassProps(transparency, cl("tooltip-card"))}>
            <div className={cl("tooltip-title")}>{paused ? "Paused following" : "Following"} {name}</div>
            <div className={cl("tooltip-detail")}>{location ? `In ${location}` : "Not in a voice channel you can see"}</div>
            <div className={cl("tooltip-detail")}>Click to join, right-click for options</div>
        </div>
    );
}

export function FollowIndicator() {
    const { followUserId, paused, transparency } = settings.use(["followUserId", "paused", "transparency"]);
    const user = useStateFromStores([UserStore], () => UserStore.getUser(followUserId));
    const location = useStateFromStores([VoiceStateStore, ChannelStore, GuildStore], () => getVoiceLocation(followUserId));
    const [panelOpen, setPanelOpen] = useState(false);
    const indicatorRef = useRef<HTMLDivElement>(null);

    if (!followUserId) return null;

    const name = getDisplayName(followUserId);

    const closePanel = (restoreFocus?: boolean) => {
        setPanelOpen(false);
        if (restoreFocus) indicatorRef.current?.focus();
    };

    return (
        <div className={cl("container")}>
            <Popout
                position="right"
                align="center"
                nudgeAlignIntoViewport
                spacing={16}
                animation={Popout.Animation.NONE}
                shouldShow={panelOpen}
                onRequestClose={() => setPanelOpen(false)}
                targetElementRef={indicatorRef}
                renderPopout={() => <SafeFollowPanel onClose={closePanel} />}
            >
                {() => (
                    <Tooltip
                        text={<FollowTooltip name={name} paused={paused} location={location} transparency={transparency} />}
                        position="right"
                        shouldShow={!panelOpen}
                        tooltipClassName={cl("tooltip")}
                        tooltipContentClassName={cl("tooltip-content")}
                    >
                        {tooltipProps => (
                            <div
                                {...tooltipProps}
                                ref={indicatorRef}
                                className={cl("indicator", { paused, open: panelOpen })}
                                role="button"
                                tabIndex={0}
                                aria-label={`${paused ? "Paused following" : "Following"} ${name}`}
                                aria-haspopup="dialog"
                                aria-expanded={panelOpen}
                                onClick={() => {
                                    tooltipProps.onClick?.();
                                    setPanelOpen(false);
                                    joinNow();
                                }}
                                onContextMenu={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    tooltipProps.onContextMenu?.();
                                    setPanelOpen(open => !open);
                                }}
                                onKeyDown={e => {
                                    if (e.key !== "Enter" && e.key !== " ") return;

                                    e.preventDefault();
                                    joinNow();
                                }}
                            >
                                {user
                                    ? <img className={cl("avatar")} src={user.getAvatarURL(undefined, 96)} alt="" />
                                    : <div className={cl("avatar")}><FollowIcon following /></div>}
                                <StatusBadge state={paused ? "paused" : location ? "active" : "idle"} />
                            </div>
                        )}
                    </Tooltip>
                )}
            </Popout>
        </div>
    );
}
