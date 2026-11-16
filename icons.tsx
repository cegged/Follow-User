/*
 * Follow User, a Vencord plugin
 * Copyright (c) 2026 cegged <https://github.com/cegged> (Discord: @c3g, ID 453743721402466317)
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classes } from "@utils/misc";

export interface IconProps {
    className?: string;
    height?: string | number;
    width?: string | number;
}

const WALKING_PERSON = "M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7";

export function FollowIcon({ className, height = 24, width = 24, following = false }: IconProps & { following?: boolean; }) {
    return (
        <svg
            className={classes(className, "vc-follow-user-icon")}
            width={width}
            height={height}
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
        >
            <path d={WALKING_PERSON} transform="translate(-3.5 3.4) scale(.72)" opacity={following ? 1 : 0.45} />
            <path d={WALKING_PERSON} transform="translate(8.5 3.4) scale(.72)" />
        </svg>
    );
}

export function FollowingIcon(props: IconProps) {
    return <FollowIcon {...props} following />;
}

function makeWalkerIcon(symbol: string) {
    return ({ className, height = 24, width = 24 }: IconProps) => (
        <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={WALKING_PERSON} transform="translate(-4.3 2.4) scale(.8)" />
            <path d={symbol} />
        </svg>
    );
}

export const JoinIcon = makeWalkerIcon("M15 3.5h5.5A1.5 1.5 0 0 1 22 5v14a1.5 1.5 0 0 1-1.5 1.5H15v-2h5v-13h-5z");
export const PauseIcon = makeWalkerIcon("M14 7h2.6v10H14zM18.9 7h2.6v10h-2.6z");
export const ResumeIcon = makeWalkerIcon("M14 6.5v11l8.5-5.5z");
export const UnfollowIcon = makeWalkerIcon("M21.9 8.5 20.5 7.1 18 9.6l-2.5-2.5-1.4 1.4 2.5 2.5-2.5 2.5 1.4 1.4 2.5-2.5 2.5 2.5 1.4-1.4-2.5-2.5z");

// A circle, half filled: how see-through the glass is
export function TransparencyIcon({ className, height = 24, width = 24 }: IconProps) {
    return (
        <svg className={className} width={width} height={height} viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M12 3.5a8.5 8.5 0 0 0 0 17Z" fill="currentColor" />
        </svg>
    );
}

// Two bars, the sign on the indicator's badge while following is paused
export function PauseBarsIcon({ className, height = 24, width = 24 }: IconProps) {
    return (
        <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4.5" height="14" rx="1.5" />
            <rect x="13.5" y="5" width="4.5" height="14" rx="1.5" />
        </svg>
    );
}
