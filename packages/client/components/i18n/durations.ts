import { createSignal } from "solid-js";

import { Language } from "./Languages";

const [durationLocale, setDurationLocale] = createSignal<Language>(null!);

export function useDurationFormat() {
  return (
    duration: Partial<Record<Intl.DurationFormatUnit, number>>,
    options: Intl.DurationFormatOptions = { style: "long" },
    // eslint-disable-next-line solid/reactivity
  ) => {
    // dur.io: in the language of the interface; a made-up one (owo, bottom…) reads as English
    try {
      return new Intl.DurationFormat(
        durationLocale()?.replace(/_/g, "-"),
        options,
      ).format(duration);
    } catch {
      return new Intl.DurationFormat("en", options).format(duration);
    }
  };
}

export function updateDurationLocale(key: Language) {
  setDurationLocale(key);
}
