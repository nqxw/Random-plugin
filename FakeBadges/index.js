(function () {
    "use strict";

    const FLAGS = {
        STAFF:               1 << 0,
        PARTNER:             1 << 1,
        HYPESQUAD_EVENTS:    1 << 2,
        BUG_HUNTER:          1 << 3,
        HYPESQUAD_BRAVERY:   1 << 6,
        HYPESQUAD_BRILLIANCE:1 << 7,
        HYPESQUAD_BALANCE:   1 << 8,
        EARLY_SUPPORTER:     1 << 9,
        BUG_HUNTER_GOLD:     1 << 14,
        VERIFIED_BOT_DEV:    1 << 17,
        MODERATOR:           1 << 18,
        ACTIVE_DEVELOPER:    1 << 22,
    };

    const GIFT_TIERS = {
        none:      0b000000,
        patron:    0b000001,
        champion:  0b000011,
        luminary:  0b000111,
        icon:      0b001111,
        hero:      0b011111,
        legend:    0b111111,
    };

    const { findByProps } = vendetta.metro;
    const { after }       = vendetta.patcher;
    const { storage }     = vendetta.plugin;
    const { showToast }   = vendetta.ui.toasts;
    const { React }       = vendetta.metro.common;

    // defaults
    if (storage.flagsOverride  === undefined) storage.flagsOverride  = 0;
    if (storage.purchasedFlags === undefined) storage.purchasedFlags = 0;
    if (storage.premiumType    === undefined) storage.premiumType    = 0;
    if (storage.premiumSince   === undefined) storage.premiumSince   = "";
    if (storage.enabled        === undefined) storage.enabled        = true;

    const patches = [];

    function injectUser(user, meId) {
        if (!user || !storage.enabled || user.id !== meId) return;
        if (storage.flagsOverride) {
            user.publicFlags  = ((user.publicFlags  ?? 0) | storage.flagsOverride) >>> 0;
            user.public_flags = user.publicFlags;
        }
        if (storage.purchasedFlags) {
            user.purchasedFlags  = ((user.purchasedFlags  ?? 0) | storage.purchasedFlags) >>> 0;
            user.purchased_flags = user.purchasedFlags;
        }
        if (storage.premiumType) {
            user.premiumType   = storage.premiumType;
            user.premium_type  = storage.premiumType;
            if (storage.premiumSince) {
                user.premiumSince  = storage.premiumSince;
                user.premium_since = storage.premiumSince;
            }
        }
    }

    const plugin = {
        onLoad() {
            const UserStore = findByProps("getUser", "getCurrentUser");
            if (!UserStore) {
                showToast("FakeBadges: UserStore not found");
                return;
            }

            const getMe = () => { try { return UserStore.getCurrentUser()?.id; } catch { return null; } };

            patches.push(after("getUser", UserStore, ([_id], user) => {
                const meId = getMe();
                if (meId) injectUser(user, meId);
            }));

            patches.push(after("getCurrentUser", UserStore, ([], user) => {
                if (user) injectUser(user, user.id);
            }));

            // Patch badge list renderer if available
            const BadgeStore = findByProps("getUserBadges");
            if (BadgeStore) {
                patches.push(after("getUserBadges", BadgeStore, ([user], badges) => {
                    const meId = getMe();
                    if (!user || !meId || user.id !== meId || !storage.enabled) return;
                    if (!storage.flagsOverride && !storage.premiumType) return;

                    const extra = [];
                    const f = storage.flagsOverride;

                    const add = (id, desc, icon) => extra.push({ id, description: desc, icon });

                    if (f & FLAGS.STAFF)                add("staff",              "Discord Staff",                   "badge_staff");
                    if (f & FLAGS.PARTNER)              add("partner",            "Partnered Server Owner",          "badge_partner");
                    if (f & FLAGS.HYPESQUAD_EVENTS)     add("hypesquad",          "HypeSquad Events",                "badge_hypesquad");
                    if (f & FLAGS.BUG_HUNTER)           add("bug_hunter_1",       "Discord Bug Hunter",              "badge_bug_hunter");
                    if (f & FLAGS.HYPESQUAD_BRAVERY)    add("hypesquad_house_1",  "HypeSquad Bravery",               "badge_hypesquad_house_1");
                    if (f & FLAGS.HYPESQUAD_BRILLIANCE) add("hypesquad_house_2",  "HypeSquad Brilliance",            "badge_hypesquad_house_2");
                    if (f & FLAGS.HYPESQUAD_BALANCE)    add("hypesquad_house_3",  "HypeSquad Balance",               "badge_hypesquad_house_3");
                    if (f & FLAGS.EARLY_SUPPORTER)      add("early_supporter",    "Early Supporter",                 "badge_early_supporter");
                    if (f & FLAGS.BUG_HUNTER_GOLD)      add("bug_hunter_2",       "Discord Bug Hunter",              "badge_bug_hunter_gold");
                    if (f & FLAGS.VERIFIED_BOT_DEV)     add("verified_developer", "Verified Bot Developer",          "badge_early_verified_developer");
                    if (f & FLAGS.MODERATOR)            add("certified_moderator","Discord Certified Moderator",     "badge_certified_moderator");
                    if (f & FLAGS.ACTIVE_DEVELOPER)     add("active_developer",   "Active Developer",                "badge_active_developer");
                    if (storage.premiumType >= 1)       add("premium",            "Subscriber",                      "badge_premium");

                    if (extra.length > 0) badges?.unshift(...extra);
                    return badges;
                }));
            }

            showToast("FakeBadges loaded ✓");
        },

        onUnload() {
            patches.forEach(p => p());
            patches.length = 0;
        },

        settings() {
            const { FormSection, FormSwitch, FormRow } = vendetta.ui.components.Forms;

            const BADGE_LIST = [
                ["STAFF",               "Discord Staff"],
                ["PARTNER",             "Partnered Server Owner"],
                ["HYPESQUAD_EVENTS",    "HypeSquad Events"],
                ["BUG_HUNTER",          "Bug Hunter Bronze"],
                ["HYPESQUAD_BRAVERY",   "HypeSquad Bravery"],
                ["HYPESQUAD_BRILLIANCE","HypeSquad Brilliance"],
                ["HYPESQUAD_BALANCE",   "HypeSquad Balance"],
                ["EARLY_SUPPORTER",     "Early Nitro Supporter"],
                ["BUG_HUNTER_GOLD",     "Bug Hunter Gold"],
                ["VERIFIED_BOT_DEV",    "Verified Bot Developer"],
                ["MODERATOR",           "Discord Certified Moderator"],
                ["ACTIVE_DEVELOPER",    "Active Developer"],
            ];

            const GIFT_OPTIONS = [
                ["none",     "No Gifting Badge"],
                ["patron",   "Patron  (1 gift)"],
                ["champion", "Champion (2 gifts)"],
                ["luminary", "Luminary (3 gifts)"],
                ["icon",     "Icon (6 gifts)"],
                ["hero",     "Hero (10 gifts)"],
                ["legend",   "Legend (20 gifts)"],
            ];

            return React.createElement(React.Fragment, null,
                React.createElement(FormSection, { title: "FakeBadges — client side only" },
                    React.createElement(FormSwitch, {
                        label: "Enable",
                        value: storage.enabled,
                        onValueChange: v => { storage.enabled = v; },
                    }),
                ),
                React.createElement(FormSection, { title: "Nitro" },
                    React.createElement(FormSwitch, {
                        label: "Show Nitro Badge",
                        value: storage.premiumType >= 1,
                        onValueChange: v => {
                            storage.premiumType  = v ? 2 : 0;
                            storage.premiumSince = v ? "2020-01-01T00:00:00.000Z" : "";
                        },
                    }),
                ),
                React.createElement(FormSection, { title: "Profile Badges" },
                    ...BADGE_LIST.map(([key, label]) =>
                        React.createElement(FormSwitch, {
                            key,
                            label,
                            value: !!(storage.flagsOverride & FLAGS[key]),
                            onValueChange: v => {
                                if (v) storage.flagsOverride = (storage.flagsOverride | FLAGS[key]) >>> 0;
                                else   storage.flagsOverride = (storage.flagsOverride & ~FLAGS[key]) >>> 0;
                            },
                        })
                    ),
                ),
                React.createElement(FormSection, { title: "Gifting Badge Tier" },
                    ...GIFT_OPTIONS.map(([key, label]) =>
                        React.createElement(FormSwitch, {
                            key,
                            label,
                            value: storage.purchasedFlags === GIFT_TIERS[key],
                            onValueChange: v => {
                                storage.purchasedFlags = v ? GIFT_TIERS[key] : 0;
                            },
                        })
                    ),
                ),
            );
        },
    };

    module.exports = plugin;
})();
