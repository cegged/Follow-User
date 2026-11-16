/*
 * Follow User, a Vencord plugin
 * Copyright (c) 2026 cegged <https://github.com/cegged> (Discord: @c3g, ID 453743721402466317)
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { plugins } from "@api/PluginManager";
import { CogWheel } from "@components/Icons";
import { openPluginModal } from "@components/settings";
import { debounce } from "@shared/debounce";
import { classNameFactory } from "@utils/css";
import { openUserProfile } from "@utils/discord";
import { classes } from "@utils/misc";
import type { User } from "@vencord/discord-types";
import {
    ChannelStore,
    GuildStore,
    SelectedChannelStore,
    showToast,
    useEffect,
    useRef,
    UserStore,
    UserUtils,
    useState,
    useStateFromStores,
    VoiceStateStore
} from "@webpack/common";
import type { ComponentType, CSSProperties, KeyboardEvent } from "react";

import { getDisplayName, getVoiceLocation, isTogether, joinNow, setPaused, unfollow } from "./follow";
import { FollowIcon, JoinIcon, PauseIcon, ResumeIcon, TransparencyIcon, UnfollowIcon } from "./icons";
import { AUTHOR, DEFAULT_TRANSPARENCY, settings } from "./settings";

export const cl = classNameFactory("vc-follow-user-");

const AUTHOR_ID = AUTHOR.id.toString();
const TRANSPARENCY_ID = "vc-follow-user-transparency";

// Every change to a setting rewrites Vencord's settings file, so a dragged slider saves once it settles
const saveTransparency = debounce((value: number) => {
    settings.store.transparency = value;
}, 200);

// The glass gets thinner as transparency goes up: solid at 0%, a fifth of the glass left at 100%
export function glassProps(transparency: number, className: string) {
    return {
        className: classes(cl("glass", { solid: transparency === 0 }), className),
        style: { "--vc-follow-user-opacity": 100 - 0.8 * transparency } as CSSProperties
    };
}

// The author's Discord account, fetched once if this Discord app hasn't seen it yet
function useAuthor() {
    const cached = useStateFromStores([UserStore], () => UserStore.getUser(AUTHOR_ID));
    const [fetched, setFetched] = useState<User | null>(null);

    useEffect(() => {
        if (cached) return;

        let mounted = true;
        UserUtils.getUser(AUTHOR_ID).then(user => mounted && setFetched(user), () => { });
        return () => { mounted = false; };
    }, [cached]);

    return cached ?? fetched;
}

function openAuthorProfile() {
    openUserProfile(AUTHOR_ID).catch(() => showToast({ text: "Couldn't open the profile", variant: "critical" }));
}

// Where they are and whether following is paused, e.g. "Paused · In General (My Server)"
function describeStatus(location: string | null, paused: boolean, together: boolean) {
    const where = !location
        ? "Not in a voice channel you can see"
        : together ? `With you in ${location}` : `In ${location}`;

    return paused ? `Paused · ${where}` : where;
}

interface FollowPanelProps {
    // restoreFocus puts the keyboard back on the indicator, for a panel closed with Escape
    onClose(restoreFocus?: boolean): void;
}

// Escape closes the panel. The arrow keys, Home and End move between its buttons, like in a menu
function handleKeys(e: KeyboardEvent<HTMLDivElement>, onClose: FollowPanelProps["onClose"]) {
    if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose(true);
        return;
    }

    // The slider uses the arrow keys itself
    if (e.target instanceof HTMLInputElement) return;

    const items = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-vc-follow-user-nav]")];
    const current = items.indexOf(document.activeElement as HTMLElement);
    const moves: Record<string, number> = {
        ArrowDown: current + 1,
        ArrowUp: (current < 0 ? items.length : current) - 1,
        Home: 0,
        End: items.length - 1
    };
    const next = moves[e.key];
    if (next == null || !items.length) return;

    e.preventDefault();
    items[(next + items.length) % items.length].focus();
}

interface PanelActionProps {
    icon: ComponentType<{ width?: number; height?: number; }>;
    label: string;
    danger?: boolean;
    onClick(): void;
}

function PanelAction({ icon: Icon, label, danger, onClick }: PanelActionProps) {
    return (
        <button type="button" className={cl("action", { "action-danger": danger })} data-vc-follow-user-nav onClick={onClick}>
            <Icon width={20} height={20} />
            <span className={cl("action-label")}>{label}</span>
        </button>
    );
}

// Changes the panel live while the slider moves. Reset only shows once the value is off the default
function TransparencyControl({ value, onChange }: { value: number; onChange(value: number): void; }) {
    return (
        <div id={TRANSPARENCY_ID} className={cl("transparency")}>
            <div className={cl("transparency-head")}>
                <span className={cl("transparency-label")}>Transparency</span>
                <button
                    type="button"
                    className={cl("reset", { "reset-hidden": value === DEFAULT_TRANSPARENCY })}
                    onClick={() => onChange(DEFAULT_TRANSPARENCY)}
                >
                    Reset
                </button>
            </div>
            <div className={cl("transparency-row")}>
                <input
                    type="range"
                    className={cl("range")}
                    min={0}
                    max={100}
                    step={1}
                    value={value}
                    aria-label="Transparency"
                    aria-valuetext={`${value}%`}
                    style={{ "--vc-follow-user-fill": `${value}%` } as CSSProperties}
                    onChange={e => onChange(Number(e.currentTarget.value))}
                />
                <span className={cl("transparency-value")} aria-hidden="true">{value}%</span>
            </div>
        </div>
    );
}

// The panel that opens on right-click: who you follow and where they are, then what you can do
export function FollowPanel({ onClose }: FollowPanelProps) {
    const { followUserId, paused } = settings.use(["followUserId", "paused"]);
    const user = useStateFromStores([UserStore], () => UserStore.getUser(followUserId));
    const location = useStateFromStores([VoiceStateStore, ChannelStore, GuildStore], () => getVoiceLocation(followUserId));
    const together = useStateFromStores([VoiceStateStore, SelectedChannelStore], () => isTogether(followUserId));
    const author = useAuthor();
    // The settings page's slider can save fractions, so the panel's own slider starts from a whole number
    const [transparency, setTransparency] = useState(() => Math.round(settings.store.transparency));
    const [showTransparency, setShowTransparency] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    // The panel takes the keyboard when it opens, the way a menu does
    useEffect(() => {
        panelRef.current?.focus({ preventScroll: true });
    }, []);

    const changeTransparency = (value: number) => {
        setTransparency(value);
        saveTransparency(value);
    };

    // Every action closes the panel first, like choosing an item in a menu
    const run = (action: () => unknown) => () => {
        onClose();
        action();
    };

    const status = describeStatus(location, paused, together);

    return (
        <div
            ref={panelRef}
            {...glassProps(transparency, cl("panel"))}
            role="dialog"
            aria-label="Follow User"
            tabIndex={-1}
            onKeyDown={e => handleKeys(e, onClose)}
        >
            <header className={cl("panel-header")}>
                {user
                    ? <img className={cl("panel-avatar")} src={user.getAvatarURL(undefined, 80)} alt="" />
                    : <div className={cl("panel-avatar")}><FollowIcon following /></div>}
                <div className={cl("panel-identity")}>
                    <div className={cl("panel-name")}>{getDisplayName(followUserId)}</div>
                    <div className={cl("panel-status")} title={status}>{status}</div>
                </div>
                <button
                    type="button"
                    className={cl("icon-button")}
                    title="Transparency"
                    aria-label="Transparency"
                    aria-expanded={showTransparency}
                    aria-controls={showTransparency ? TRANSPARENCY_ID : undefined}
                    data-vc-follow-user-nav
                    onClick={() => setShowTransparency(shown => !shown)}
                >
                    <TransparencyIcon width={18} height={18} />
                </button>
            </header>

            {showTransparency && <TransparencyControl value={transparency} onChange={changeTransparency} />}

            <div className={cl("actions")} role="group">
                {!together && <PanelAction icon={JoinIcon} label="Join Now" onClick={run(joinNow)} />}
                <PanelAction
                    icon={paused ? ResumeIcon : PauseIcon}
                    label={paused ? "Resume Following" : "Pause Following"}
                    onClick={run(() => setPaused(!paused))}
                />
                <PanelAction icon={UnfollowIcon} label="Unfollow" danger onClick={run(unfollow)} />
            </div>

            <div className={cl("separator")} role="separator" />

            <footer className={cl("footer")}>
                <button
                    type="button"
                    className={cl("footer-button")}
                    data-vc-follow-user-nav
                    onClick={run(() => openPluginModal(plugins["Follow User"]))}
                >
                    <CogWheel width={16} height={16} />
                    Settings
                </button>
                <button
                    type="button"
                    className={cl("footer-button", "credit")}
                    title="Open profile"
                    data-vc-follow-user-nav
                    onClick={run(openAuthorProfile)}
                >
                    {author
                        ? <img className={cl("credit-avatar")} src={author.getAvatarURL(undefined, 64)} alt="" />
                        : <span className={cl("credit-avatar")} />}
                    <span className={cl("credit-text")}>Made by @{author?.username ?? "c3g"}</span>
                </button>
            </footer>
        </div>
    );
}
