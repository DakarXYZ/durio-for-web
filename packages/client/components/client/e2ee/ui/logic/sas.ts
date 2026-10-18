// SAS verification as the dialog shows it (dur.io, plan WEB-07, CR-11, AN-31): the core
// holds the state machine, the dialog only maps `E2eeSasState` to a step and the
// actions the user may take.
import type { E2eeSasAction, E2eeSasState } from "stoat.js";

export type SasStep =
  /** We asked: waiting for the other device to accept */
  | "requested"
  /** The other device asks: accept or decline */
  | "incoming"
  /** Both ready: start comparing */
  | "ready"
  /** Keys are being exchanged */
  | "waiting"
  /** Compare the emoji */
  | "compare"
  /** We confirmed: waiting for the other side */
  | "confirmed"
  | "done"
  /** The codes did not match: possible attack */
  | "mismatch"
  | "timeout"
  | "cancelled";

export interface SasView {
  step: SasStep;
  /** Buttons, in order */
  actions: E2eeSasAction[];
  /** The flow is over: the dialog only closes */
  final: boolean;
}

/**
 * What the dialog shows for a state of the flow
 * @param state State from the core
 */
export function sasView(state: E2eeSasState): SasView {
  switch (state.type) {
    case "Requested":
      return { step: "requested", actions: ["cancel"], final: false };
    case "Incoming":
      return { step: "incoming", actions: ["cancel", "accept"], final: false };
    case "Ready":
      return { step: "ready", actions: ["cancel", "start"], final: false };
    case "Started":
      return { step: "waiting", actions: ["cancel"], final: false };
    case "ShowCodes":
      return {
        step: "compare",
        actions: ["mismatch", "confirm"],
        final: false,
      };
    case "Confirmed":
      return { step: "confirmed", actions: ["cancel"], final: false };
    case "Done":
      return { step: "done", actions: [], final: true };
    case "Cancelled":
      return {
        step:
          state.reason === "Mismatch"
            ? "mismatch"
            : state.reason === "Timeout"
              ? "timeout"
              : "cancelled",
        actions: [],
        final: true,
      };
  }
}

/**
 * Russian names of the 64 SAS emoji by index: the Matrix table (`sas-emoji.json`,
 * `translated_descriptions.ru`), as checked for Android (`strings_durio_e2ee_verify.xml`).
 * One deviation: 34 (Spanner) is «Гаечный ключ» — the table has «Ключ», like 47 (Key).
 */
export const SAS_EMOJI_RU = [
  "Собака",
  "Кошка",
  "Лев",
  "Лошадь",
  "Единорог",
  "Свинья",
  "Слон",
  "Кролик",
  "Панда",
  "Петух",
  "Пингвин",
  "Черепаха",
  "Рыба",
  "Осьминог",
  "Бабочка",
  "Цветок",
  "Дерево",
  "Кактус",
  "Гриб",
  "Глобус",
  "Луна",
  "Облако",
  "Огонь",
  "Банан",
  "Яблоко",
  "Клубника",
  "Кукуруза",
  "Пицца",
  "Торт",
  "Сердце",
  "Улыбка",
  "Робот",
  "Шляпа",
  "Очки",
  "Гаечный ключ",
  "Санта",
  "Большой палец вверх",
  "Зонт",
  "Песочные часы",
  "Часы",
  "Подарок",
  "Лампочка",
  "Книга",
  "Карандаш",
  "Скрепка",
  "Ножницы",
  "Замок",
  "Ключ",
  "Молоток",
  "Телефон",
  "Флаг",
  "Поезд",
  "Велосипед",
  "Самолет",
  "Ракета",
  "Кубок",
  "Мяч",
  "Гитара",
  "Труба",
  "Колокол",
  "Якорь",
  "Наушники",
  "Папка",
  "Булавка",
] as const;

/**
 * Name of a SAS emoji in the UI language: Russian from the table above, otherwise the
 * English name the core gives (the translation key of the Matrix table)
 * @param emoji Index and English name
 * @param locale UI locale
 */
export function sasEmojiName(
  emoji: { index: number; description: string },
  locale: string,
): string {
  if (locale.toLowerCase().startsWith("ru"))
    return SAS_EMOJI_RU[emoji.index] ?? emoji.description;
  return emoji.description;
}
