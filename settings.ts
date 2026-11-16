/*
 * Follow User, a Vencord plugin
 * Copyright (c) 2026 cegged <https://github.com/cegged> (Discord: @c3g, ID 453743721402466317)
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

// Credited in Vencord's plugin list and at the bottom of the indicator's panel
export const AUTHOR = { name: "cegged", id: 453743721402466317n };

// See-through enough that what's behind the glass shows, while the text on it stays clear
export const DEFAULT_TRANSPARENCY = 65;

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
    transparency: {
        type: OptionType.SLIDER,
        description: "How see-through the indicator's panel and tooltip are, from 0% (solid) to 100%. Also in the panel, from the button next to the name",
        markers: [0, 25, 50, 75, 100],
        default: DEFAULT_TRANSPARENCY,
        stickToMarkers: false
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
