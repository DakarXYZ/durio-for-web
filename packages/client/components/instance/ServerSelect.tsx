import { createSignal, onMount } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { useNavigate } from "@solidjs/router";
import { styled } from "styled-system/jsx";

import { durioNative } from "@revolt/common/lib/desktop";
import { normalizeHost } from "@revolt/common/lib/env";

/**
 * Server address screen (dur.io, O13): there is no built-in server, the user enters the
 * host of any instance (`<name>.duckdns.org`); discovery and login continue at `/i/<host>/`.
 * Rendered outside of any instance, so it has no theme and uses fixed colours.
 */
export default function ServerSelect() {
  const navigate = useNavigate();
  const [address, setAddress] = createSignal("");

  // the desktop app may suggest an address set at its build (empty by default, O13)
  onMount(async () => {
    try {
      const suggested = await durioNative()?.servers?.default?.();
      if (suggested && !address()) setAddress(suggested);
    } catch {
      // no suggestion
    }
  });

  function connect(e: Event) {
    e.preventDefault();
    const host = normalizeHost(address());
    if (host) navigate(`/i/${host}/`);
  }

  return (
    <Base>
      <Form onSubmit={connect}>
        <Title>dur.io</Title>
        <label for="server-address">
          <Trans>Server address</Trans>
        </label>
        <Input
          id="server-address"
          type="text"
          inputmode="url"
          autocapitalize="none"
          autocomplete="url"
          spellcheck={false}
          placeholder="name.duckdns.org"
          value={address()}
          onInput={(e) => setAddress(e.currentTarget.value)}
          autofocus
        />
        <Button type="submit" disabled={!normalizeHost(address())}>
          <Trans>Connect</Trans>
        </Button>
      </Form>
    </Base>
  );
}

const Base = styled("div", {
  base: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    background: "#1b1f2a",
    color: "#e6e8ee",
    fontFamily: "sans-serif",
  },
});

const Form = styled("form", {
  base: {
    width: "100%",
    maxWidth: "360px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
});

const Title = styled("h1", {
  base: {
    fontSize: "32px",
    fontWeight: 700,
    margin: "0 0 12px",
  },
});

const Input = styled("input", {
  base: {
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #3a4152",
    background: "#11141b",
    color: "inherit",
    fontSize: "16px",
  },
});

const Button = styled("button", {
  base: {
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    background: "#e6e8ee",
    color: "#1b1f2a",
    fontSize: "16px",
    fontWeight: 600,
    cursor: "pointer",
    "&:disabled": {
      opacity: 0.5,
      cursor: "default",
    },
  },
});
