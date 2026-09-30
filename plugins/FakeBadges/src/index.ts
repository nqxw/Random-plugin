import { findByProps } from "@vendetta/metro";
import { before } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";

// ── Badge flag constants (Discord public_flags bitmask) ────────────────────────
export const FLAGS = {
    STAFF:                  1 << 0,   // Discord Staff
    PARTNER:                1 << 1,   // Partnered Server Owner
    HYPESQUAD_EVENTS:       1 << 2,   // HypeSquad Events
    BUG_HUNTER:             1 << 3,   // Bug Hunter Bronze
    HYPESQUAD_BRAVERY:      1 << 6,   // HypeSquad Bravery
    HYPESQUAD_BRILLIANCE:   1 << 7,   // HypeSquad Brilliance
    HYPESQUAD_BALANCE:      1 << 8,   // HypeSquad Balance
    EARLY_SUPPORTER:        1 << 9,   // Early Nitro Supporter
    BUG_HUNTER_GOLD:        1 << 14,  // Bug Hunter Gold
    VERIFIED_BOT_DEV:       1 << 17,  // Early Verified Bot Developer
    MODERATOR:              1 << 18,  // Discord Certified Moderator
    ACTIVE_DEVELOPER:       1 << 22,  // Active Developer
};

// ── Gifting badge tiers (purchased_flags) ─────────────────────────────────────
export const GIFT_TIERS = {
    PATRON:    0b000001,   // Gifted 1x
    CHAMPION:  0b000011,   // Gifted 2x
    LUMINARY:  0b000111,   // Gifted 3x
    ICON:      0b001111,   // Gifted 6x
    HERO:      0b011111,   // Gifted 10x
    LEGEND:    0b111111,   // Gifted 20x
};

// ── Default storage ────────────────────────────────────────────────────────────
storage.flagsOverride    ??= 0;
storage.purchasedFlags   ??= 0;
storage.premiumType      ??= 0;   // 0=none, 1=Classic, 2=Nitro
storage.premiumSince     ??= "";  // ISO date string or ""
storage.enabled          ??= true;

// ── Patches list ──────────────────────────────────────────────────────────────
const patches: (() => void)[] = [];

function patchUser(user: any) {
    if (!user || !storage.enabled) return user;

    // Inject public_flags override
    if (storage.flagsOverride) {
        user.publicFlags = (user.publicFlags ?? 0) | storage.flagsOverride;
        // Alias both field names Discord uses
        user.public_flags = user.publicFlags;
    }

    // Inject purchased_flags (gifting badges)
    if (storage.purchasedFlags) {
        user.purchasedFlags = (user.purchasedFlags ?? 0) | storage.purchasedFlags;
        user.purchased_flags = user.purchasedFlags;
    }

    // Inject Nitro (premium_type / premium_since)
    if (storage.premiumType) {
        user.premiumType   = storage.premiumType;
        user.premium_type  = storage.premiumType;
        if (storage.premiumSince) {
            user.premiumSince  = storage.premiumSince;
            user.premium_since = storage.premiumSince;
        }
    }

    return user;
}

export default {
    // ── Plugin lifecycle ────────────────────────────────────────────────────────
    onLoad() {
        // Patch UserStore.getUser — called whenever a profile is displayed
        const UserStore = findByProps("getUser", "getCurrentUser");
        if (UserStore) {
            patches.push(
                before("getUser", UserStore, ([id]) => {
                    // We intercept the return value via after, but
                    // before lets us know which user is being fetched
                })
            );

            // Patch the return value of getUser
            const { after } = require("@vendetta/patcher");
            patches.push(
                after("getUser", UserStore, ([_id], user) => {
                    if (!user) return;
                    const me = UserStore.getCurrentUser();
                    // Only patch own user object
                    if (me && user.id === me.id) patchUser(user);
                })
            );

            // Also patch getCurrentUser directly
            patches.push(
                after("getCurrentUser", UserStore, ([],  user) => {
                    if (!user) return;
                    patchUser(user);
                })
            );
        }

        // Patch UserProfile module if present (profile sheet)
        const ProfileBadges = findByProps("getUserBadges");
        if (ProfileBadges) {
            const { after } = require("@vendetta/patcher");
            patches.push(
                after("getUserBadges", ProfileBadges, ([user], badges: any[]) => {
                    if (!user || !storage.enabled || !storage.flagsOverride) return;
                    const me = findByProps("getUser","getCurrentUser")?.getCurrentUser();
                    if (!me || user.id !== me.id) return;

                    const extra: any[] = [];
                    const f = storage.flagsOverride;

                    if (f & FLAGS.STAFF)
                        extra.push({ id: "staff",            description: "Discord Staff",                       icon: "badge_staff" });
                    if (f & FLAGS.PARTNER)
                        extra.push({ id: "partner",          description: "Partnered Server Owner",              icon: "badge_partner" });
                    if (f & FLAGS.HYPESQUAD_EVENTS)
                        extra.push({ id: "hypesquad",        description: "HypeSquad Events",                   icon: "badge_hypesquad" });
                    if (f & FLAGS.BUG_HUNTER)
                        extra.push({ id: "bug_hunter_1",     description: "Discord Bug Hunter",                 icon: "badge_bug_hunter" });
                    if (f & FLAGS.HYPESQUAD_BRAVERY)
                        extra.push({ id: "hypesquad_house_1",description: "HypeSquad Bravery",                  icon: "badge_hypesquad_house_1" });
                    if (f & FLAGS.HYPESQUAD_BRILLIANCE)
                        extra.push({ id: "hypesquad_house_2",description: "HypeSquad Brilliance",               icon: "badge_hypesquad_house_2" });
                    if (f & FLAGS.HYPESQUAD_BALANCE)
                        extra.push({ id: "hypesquad_house_3",description: "HypeSquad Balance",                  icon: "badge_hypesquad_house_3" });
                    if (f & FLAGS.EARLY_SUPPORTER)
                        extra.push({ id: "early_supporter",  description: "Early Supporter",                    icon: "badge_early_supporter" });
                    if (f & FLAGS.BUG_HUNTER_GOLD)
                        extra.push({ id: "bug_hunter_2",     description: "Discord Bug Hunter",                 icon: "badge_bug_hunter_gold" });
                    if (f & FLAGS.VERIFIED_BOT_DEV)
                        extra.push({ id: "verified_developer",description:"Verified Bot Developer",             icon: "badge_early_verified_developer" });
                    if (f & FLAGS.MODERATOR)
                        extra.push({ id: "certified_moderator",description: "Discord Certified Moderator",      icon: "badge_certified_moderator" });
                    if (f & FLAGS.ACTIVE_DEVELOPER)
                        extra.push({ id: "active_developer", description: "Active Developer",                   icon: "badge_active_developer" });

                    // Nitro badge
                    if (storage.premiumType >= 1)
                        extra.push({ id: "premium",          description: "Subscriber",                         icon: "badge_premium" });

                    // Inject before existing badges
                    if (extra.length > 0) {
                        badges?.splice(0, 0, ...extra);
                    }

                    return badges;
                })
            );
        }

        showToast("FakeBadges loaded", getAssetIDByName("ic_check_24px"));
    },

    onUnload() {
        patches.forEach(p => p());
        patches.length = 0;
    },

    // ── Settings page ───────────────────────────────────────────────────────────
    settings: () => {
        const { React } = require("@vendetta/metro/common");
        const { Forms, General } = require("@vendetta/ui/components");
        const { FormRow, FormSection, FormSwitch, FormDivider } = Forms;
        const { Text } = General;

        const BADGES = [
            ["STAFF",               "Discord Staff"],
            ["PARTNER",             "Partnered Server Owner"],
            ["HYPESQUAD_EVENTS",    "HypeSquad Events"],
            ["BUG_HUNTER",          "Bug Hunter Bronze"],
            ["HYPESQUAD_BRAVERY",   "HypeSquad Bravery"],
            ["HYPESQUAD_BRILLIANCE","HypeSquad Brilliance"],
            ["HYPESQUAD_BALANCE",   "HypeSquad Balance"],
            ["EARLY_SUPPORTER",     "Early Nitro Supporter"],
            ["BUG_HUNTER_GOLD",     "Bug Hunter Gold"],
            ["VERIFIED_BOT_DEV",    "Early Verified Bot Developer"],
            ["MODERATOR",           "Discord Certified Moderator"],
            ["ACTIVE_DEVELOPER",    "Active Developer"],
        ];

        const GIFT_OPTIONS = [
            ["none",     0b000000, "No Gifting Badge"],
            ["PATRON",   0b000001, "Patron (1 gift)"],
            ["CHAMPION", 0b000011, "Champion (2 gifts)"],
            ["LUMINARY", 0b000111, "Luminary (3 gifts)"],
            ["ICON",     0b001111, "Icon (6 gifts)"],
            ["HERO",     0b011111, "Hero (10 gifts)"],
            ["LEGEND",   0b111111, "Legend (20 gifts)"],
        ];

        return React.createElement(
            React.Fragment,
            null,
            React.createElement(
                FormSection,
                { title: "FakeBadges — CLIENT SIDE ONLY" },
                React.createElement(FormSwitch, {
                    label:    "Enable",
                    subLabel: "Toggle all fake badge patches on/off",
                    value:    storage.enabled,
                    onValueChange: (v: boolean) => { storage.enabled = v; },
                }),
            ),
            React.createElement(
                FormSection,
                { title: "Nitro Badge" },
                React.createElement(FormSwitch, {
                    label:    "Show Nitro Badge",
                    value:    storage.premiumType >= 1,
                    onValueChange: (v: boolean) => {
                        storage.premiumType  = v ? 2 : 0;
                        storage.premiumSince = v ? "2020-01-01T00:00:00.000Z" : "";
                    },
                }),
            ),
            React.createElement(
                FormSection,
                { title: "Profile Badges" },
                ...BADGES.map(([key, label]) =>
                    React.createElement(FormSwitch, {
                        key,
                        label,
                        value:    !!(storage.flagsOverride & FLAGS[key as keyof typeof FLAGS]),
                        onValueChange: (v: boolean) => {
                            if (v) storage.flagsOverride |=  FLAGS[key as keyof typeof FLAGS];
                            else   storage.flagsOverride &= ~FLAGS[key as keyof typeof FLAGS];
                        },
                    })
                ),
            ),
            React.createElement(
                FormSection,
                { title: "Gifting Badge Tier" },
                ...GIFT_OPTIONS.map(([key, bits, label]) =>
                    React.createElement(FormRow, {
                        key,
                        label,
                        trailing: React.createElement(FormSwitch, {
                            value:    storage.purchasedFlags === bits,
                            onValueChange: (v: boolean) => {
                                storage.purchasedFlags = v ? bits : 0;
                            },
                        }),
                    })
                ),
            ),
        );
    },
};
