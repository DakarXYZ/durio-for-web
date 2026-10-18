import { type JSX, Show, onCleanup } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Symbol } from "@revolt/ui/components/utils/Symbol";

/**
 * "beta" next to everything end-to-end encrypted (O8: no external audit)
 */
export function Beta() {
  return (
    <BetaLabel>
      <Trans>beta</Trans>
    </BetaLabel>
  );
}

const BetaLabel = styled("span", {
  base: {
    marginInlineStart: "var(--gap-sm)",
    padding: "0 6px",
    borderRadius: "var(--borderRadius-full)",
    fontSize: "0.75em",
    fontWeight: 600,
    textTransform: "uppercase",
    verticalAlign: "middle",
    color: "var(--md-sys-color-on-tertiary-container)",
    background: "var(--md-sys-color-tertiary-container)",
  },
});

/**
 * An inline notice: information, a warning or an error
 */
export function Notice(props: {
  kind?: "info" | "warning" | "error";
  icon?: string;
  children: JSX.Element;
  action?: JSX.Element;
}) {
  return (
    <NoticeBox kind={props.kind ?? "info"}>
      <Symbol size={20}>
        {props.icon ??
          (props.kind === "error"
            ? "gpp_maybe"
            : props.kind === "warning"
              ? "warning"
              : "info")}
      </Symbol>
      <div>
        {props.children}
        <Show when={props.action}>
          <div>{props.action}</div>
        </Show>
      </div>
    </NoticeBox>
  );
}

const NoticeBox = styled("div", {
  base: {
    display: "flex",
    gap: "var(--gap-md)",
    alignItems: "flex-start",
    padding: "var(--gap-md)",
    borderRadius: "var(--borderRadius-md)",
    lineHeight: "1.4",
  },
  variants: {
    kind: {
      info: {
        color: "var(--md-sys-color-on-surface-variant)",
        background: "var(--md-sys-color-surface-container-high)",
      },
      warning: {
        color: "var(--md-sys-color-on-tertiary-container)",
        background: "var(--md-sys-color-tertiary-container)",
      },
      error: {
        color: "var(--md-sys-color-on-error-container)",
        background: "var(--md-sys-color-error-container)",
      },
    },
  },
});

/**
 * A field for secrets (recovery key, passphrases): no autocomplete, no spellchecker
 * (Electron's would see the text), cleared when it goes away
 */
export function SecretField(props: {
  label: JSX.Element;
  value: string;
  onInput: (value: string) => void;
  type?: "password" | "text";
  multiline?: boolean;
  autofocus?: boolean;
  helper?: JSX.Element;
  error?: boolean;
}) {
  onCleanup(() => props.onInput(""));

  const common = {
    autocomplete: "off",
    autocapitalize: "none",
    autocorrect: "off",
    spellcheck: false,
    get value() {
      return props.value;
    },
    get autofocus() {
      return props.autofocus;
    },
  } as const;

  return (
    <SecretLabel>
      <span>{props.label}</span>
      <Show
        when={props.multiline}
        fallback={
          <SecretInput
            {...common}
            error={props.error}
            type={props.type ?? "password"}
            onInput={(e) => props.onInput(e.currentTarget.value)}
          />
        }
      >
        <SecretArea
          {...common}
          error={props.error}
          rows={3}
          onInput={(e) => props.onInput(e.currentTarget.value)}
        />
      </Show>
      <Show when={props.helper}>
        <Helper error={props.error}>{props.helper}</Helper>
      </Show>
    </SecretLabel>
  );
}

const SecretLabel = styled("label", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-xs)",
    fontSize: "0.9em",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const field = {
  padding: "10px 12px",
  borderRadius: "var(--borderRadius-md)",
  border: "1px solid var(--md-sys-color-outline-variant)",
  background: "var(--md-sys-color-surface-container-highest)",
  color: "var(--md-sys-color-on-surface)",
  fontSize: "1rem",
  outline: "none",
  "&:focus": { borderColor: "var(--md-sys-color-primary)" },
} as const;

const SecretInput = styled("input", {
  base: field,
  variants: {
    error: { true: { borderColor: "var(--md-sys-color-error)" } },
  },
});

const SecretArea = styled("textarea", {
  base: { ...field, fontFamily: "var(--fonts-monospace)", resize: "none" },
  variants: {
    error: { true: { borderColor: "var(--md-sys-color-error)" } },
  },
});

const Helper = styled("span", {
  base: { fontSize: "0.85em" },
  variants: {
    error: { true: { color: "var(--md-sys-color-error)" } },
  },
});

/**
 * Text the user reads or compares character by character
 */
export const Mono = styled("div", {
  base: {
    fontFamily: "var(--fonts-monospace)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    userSelect: "all",
    padding: "var(--gap-md)",
    borderRadius: "var(--borderRadius-md)",
    background: "var(--md-sys-color-surface-container-highest)",
    color: "var(--md-sys-color-on-surface)",
  },
});

/**
 * A report shown in full before it is saved
 */
export const ReportText = styled("pre", {
  base: {
    fontFamily: "var(--fonts-monospace)",
    fontSize: "0.8em",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    maxHeight: "40vh",
    overflowY: "auto",
    padding: "var(--gap-md)",
    borderRadius: "var(--borderRadius-md)",
    background: "var(--md-sys-color-surface-container-highest)",
    color: "var(--md-sys-color-on-surface)",
  },
});

export const Stack = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-md)",
    maxWidth: "520px",
  },
});

export const Buttons = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "var(--gap-sm)",
  },
});

/**
 * Save text as a file through the browser's download (the desktop app shows its
 * save dialog); the object URL is revoked right away
 * @param name File name
 * @param text Content
 */
export function saveTextFile(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
