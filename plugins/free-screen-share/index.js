// Free Screen Share for shelter, by Demoniskk.
// Based on redstonekasi's moonlight "freeScreenShare" extension:
// https://github.com/redstonekasi/moonlight-extensions/tree/main/src/freeScreenShare
//
// moonlight patches Discord's source so `canStreamQuality` always returns true.
// shelter can't patch source, and the object holding `canStreamQuality` is
// Object.freeze()'d behind a non-configurable webpack export, so it can't be
// replaced at runtime either.
//
// Instead we hook the first thing that check does with the user:
//   canStreamQuality(q, user) -> e_(feature, user) -> user.isPremiumWithFractionalPremiumOnly()
// When that call comes from canStreamQuality, we make the user look like Nitro
// for the rest of the synchronous call, then restore it:
//   - premiumType = 2 so the product catalog check passes
//   - perks = null so Discord doesn't use the perks bitmask path instead

const {
	flux: { stores },
	plugin: { scoped },
} = shelter;

const HOOK = "isPremiumWithFractionalPremiumOnly";
const CALLER = "canStreamQuality";
const NITRO = 2; // PremiumTypes.TIER_2

let proto;
let original;
const faked = new Map(); // user -> { premiumType, perks }

function calledFromCanStreamQuality() {
	const limit = Error.stackTraceLimit;
	Error.stackTraceLimit = 6;
	const stack = new Error().stack;
	Error.stackTraceLimit = limit;
	return stack?.includes(CALLER) ?? false;
}

function restore() {
	for (const [user, real] of faked) {
		try {
			user.premiumType = real.premiumType;
			user.perks = real.perks;
		} catch {}
	}
	faked.clear();
}

function fake(user) {
	if (faked.has(user)) return;
	try {
		const real = { premiumType: user.premiumType, perks: user.perks };
		user.premiumType = NITRO;
		user.perks = null;
		faked.set(user, real);
		if (faked.size === 1) queueMicrotask(restore);
	} catch (e) {
		console.error("[freeScreenShare] couldn't modify user", e);
	}
}

// Calls Discord's real canStreamQuality so the console shows whether the patch works.
function selfTest(user) {
	try {
		let wreq;
		window.webpackChunkdiscord_app.push([[Symbol()], {}, (r) => (wreq = r)]);
		window.webpackChunkdiscord_app.pop();
		for (const mod of Object.values(wreq.c)) {
			const exp = mod?.exports;
			if (!exp || typeof exp !== "object") continue;
			for (const k of Object.keys(exp)) {
				let v;
				try {
					v = exp[k];
				} catch {
					continue;
				}
				if (typeof v?.[CALLER] !== "function" || !v.StreamQuality) continue;
				const high = v[CALLER](v.StreamQuality.HIGH, user);
				const mid = v[CALLER](v.StreamQuality.MID, user);
				console.log(`[freeScreenShare] self-test: high=${high} mid=${mid}`);
				return;
			}
		}
		console.warn("[freeScreenShare] self-test: canStreamQuality not found");
	} catch (e) {
		console.warn("[freeScreenShare] self-test failed", e);
	}
}

function patch() {
	if (original) return true;
	const user = stores.UserStore?.getCurrentUser?.();
	if (!user) return false;

	proto = Object.getPrototypeOf(user);
	while (proto && !Object.prototype.hasOwnProperty.call(proto, HOOK)) proto = Object.getPrototypeOf(proto);
	if (!proto) {
		console.error(`[freeScreenShare] User.${HOOK} not found, Discord probably changed`);
		return true; // don't keep retrying
	}

	original = proto[HOOK];
	proto[HOOK] = function (...args) {
		const result = original.apply(this, args);
		try {
			if (!result && calledFromCanStreamQuality()) fake(this);
		} catch {}
		return result;
	};
	console.log("[freeScreenShare] patched");
	selfTest(user);
	return true;
}

if (!patch()) {
	scoped.flux.subscribe("CONNECTION_OPEN", () => patch());
}

export function onUnload() {
	if (proto && original) proto[HOOK] = original;
	proto = original = undefined;
	restore();
}
