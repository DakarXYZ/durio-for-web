import {
  ComponentProps,
  Show,
  createEffect,
  createSignal,
  on,
  splitProps,
} from "solid-js";

import emojiRegex from "emoji-regex";
import { styled } from "styled-system/jsx";

import { useState } from "@revolt/state";
import { EmojiBase, twemojiName } from ".";

// openmoji is off due to incomplete implementation

export type UnicodeEmojiPacks =
  | "fluent-3d"
  | "fluent-color"
  | "fluent-flat"
  | "mutant"
  | "noto"
  //  | "openmoji"
  | "twemoji";

export const UNICODE_EMOJI_PACKS: UnicodeEmojiPacks[] = [
  "fluent-3d",
  "fluent-color",
  "fluent-flat",
  "mutant",
  "noto",
  //  "openmoji",
  "twemoji",
];

export const UNICODE_EMOJI_PACK_PUA: Record<string, string> = {
  // omit fluent-3d as it is the default (canonically \uE0E1)
  "fluent-flat": "\uE0E2",
  mutant: "\uE0E3",
  noto: "\uE0E4",
  //  openmoji: "\uE0E5",
  twemoji: "\uE0E6",
};

const UNICODE_EMOJI_REGIONAL_INDICATORS =
  "\u{1f1e6}|\u{1f1e7}|\u{1f1e8}|\u{1f1e9}|\u{1f1ea}|\u{1f1eb}|\u{1f1ec}|\u{1f1ed}|\u{1f1ee}|\u{1f1ef}|\u{1f1f0}|\u{1f1f1}|\u{1f1f2}|\u{1f1f3}|\u{1f1f4}|\u{1f1f5}|\u{1f1f6}|\u{1f1f7}|\u{1f1f8}|\u{1f1f9}|\u{1f1fa}|\u{1f1fb}|\u{1f1fc}|\u{1f1fd}|\u{1f1fe}|\u{1f1ff}";

export const UNICODE_EMOJI_MIN_PACK = "\uE0E0".codePointAt(0)!;
export const UNICODE_EMOJI_MAX_PACK = "\uE0E6".codePointAt(0)!;
export const UNICODE_ZWNJ = "\u200C";

/**
 * Regex for matching emoji
 */
export const RE_UNICODE_EMOJI = new RegExp(
  `([\uE0E0-\uE0E6]?(?:${emojiRegex().source}|(?:${UNICODE_ZWNJ}?(?:${UNICODE_EMOJI_REGIONAL_INDICATORS}))))`,
  "g",
);

export const UNICODE_EMOJI_PUA_PACK: Record<string, UnicodeEmojiPacks> = {
  ["\uE0E0"]: "fluent-3d", // default entry
  ["\uE0E1"]: "fluent-3d",
  ["\uE0E2"]: "fluent-flat",
  ["\uE0E3"]: "mutant",
  ["\uE0E4"]: "noto",
  //  ["\uE0E5"]: "openmoji",
  ["\uE0E6"]: "twemoji",
};

export const startsWithPackPUA = (emoji: string) => {
  if (emoji.startsWith(":")) return false;
  if (emoji.slice(0, 1).match("[\uE0E0-\uE0E6]")) return true;

  return false;
};

const RE_UNICODE_EMOJI_REGIONAL_INDICATOR = new RegExp(
  `^(?:${UNICODE_EMOJI_REGIONAL_INDICATORS})$`,
);

export const isRegionalIndicator = (emoji: string): boolean => {
  return !!emoji.match(RE_UNICODE_EMOJI_REGIONAL_INDICATOR);
};

/**
 * dur.io (Q63): emoji images come with the app — the Twemoji set packaged by
 * `emoji.plugin.ts` — not from static.stoat.chat: no request to Stoat, they work while
 * the server is unreachable, and a server never learns which emoji an encrypted message
 * shows. One set for every pack setting, so the pack choice is hidden.
 */
export const EMOJI_PACK_CHOICE = false;

export function unicodeEmojiUrl(
  _pack: UnicodeEmojiPacks = "fluent-3d",
  text: string,
) {
  return `${import.meta.env.BASE_URL}emoji/twemoji/${twemojiName(text)}.svg`;
}

/**
 * An emoji the packaged set does not have (newer than it) as text in the system font
 */
const NativeEmoji = styled("span", {
  base: {
    display: "inline-block",
    fontSize: "var(--emoji-size)",
    lineHeight: 1,
    margin: "0 0.05em 0 0.1em",
    verticalAlign: "-0.15em",
  },
});

/**
 * Display Unicode emoji
 */
export function UnicodeEmoji(
  props: { emoji: string; pack?: UnicodeEmojiPacks } & Omit<
    ComponentProps<typeof EmojiBase>,
    "loading" | "class" | "alt" | "draggable" | "src"
  >,
) {
  const [local, remote] = splitProps(props, ["emoji"]);
  const state = useState();
  const [missing, setMissing] = createSignal(false);
  createEffect(
    on(
      () => local.emoji,
      () => setMissing(false),
      { defer: true },
    ),
  );

  return (
    <Show
      when={!missing()}
      fallback={
        <NativeEmoji class="emoji">
          {local.emoji.replace(/[\u200C\uE0E0-\uE0E6]/g, "")}
        </NativeEmoji>
      }
    >
      <EmojiBase
        {...remote}
        loading="lazy"
        class="emoji"
        alt={local.emoji}
        draggable={false}
        src={unicodeEmojiUrl(
          props.pack ?? state.settings.getValue("appearance:unicode_emoji"),
          props.emoji,
        )}
        onError={() => setMissing(true)}
      />
    </Show>
  );
}
