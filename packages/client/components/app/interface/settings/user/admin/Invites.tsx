import {
  type Accessor,
  type JSX,
  For,
  Match,
  Show,
  Switch,
  createResource,
  createSignal,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { type AdminInvite, ADMIN_INVITE_TTL_HOURS } from "stoat.js";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { Buttons, Notice } from "@revolt/client/e2ee/ui/parts";
import { inviteLink } from "@revolt/common/lib/inviteLink";
import { useInstance } from "@revolt/instance";
import {
  Button,
  Checkbox,
  CircularProgress,
  Column,
  Dialog,
  Text,
  Time,
  useSnackbar,
} from "@revolt/ui";

import { type AdminFailure, adminFailure, shortCode } from "./logic";

type Ttl = (typeof ADMIN_INVITE_TTL_HOURS)[number];

/**
 * Invite links for new accounts (dur.io): an admin makes one for 1–24 hours, for one
 * account or many, copies it and revokes it. Links are `https://<server>/join/<code>`.
 */
export function Invites(props: {
  /** Admin mode is on: load the list */
  active: Accessor<boolean>;
  /** Run an admin call, turning admin mode on when the server asks */
  admin: <T>(call: () => Promise<T>) => Promise<T | undefined>;
  /** Why a call failed, in words */
  failureText: (failure: AdminFailure) => JSX.Element;
}) {
  const client = useClient();
  const { apiUrl } = useInstance();
  const snackbar = useSnackbar();
  const { t } = useLingui();
  // eslint-disable-next-line solid/reactivity
  const admin = props.admin;

  const [ttl, setTtl] = createSignal<Ttl>(24);
  const [multiUse, setMultiUse] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [failure, setFailure] = createSignal<AdminFailure>();
  const [revoke, setRevoke] = createSignal<AdminInvite>();

  const [invites, { refetch }] = createResource(
    () => props.active() || undefined,
    () => {
      const api = client().admin;
      return admin(() => api.invites());
    },
  );

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(inviteLink(apiUrl, code));
      snackbar.show({ message: t`Invite link copied.` });
    } catch {
      setFailure("other");
    }
  }

  async function run(call: () => Promise<unknown>) {
    setBusy(true);
    setFailure(undefined);
    try {
      await call();
    } catch (e) {
      setFailure(adminFailure(e));
    } finally {
      setBusy(false);
      void refetch();
    }
  }

  function create() {
    const api = client().admin;
    const hours = ttl();
    const multi = multiUse();
    return run(async () => {
      const invite = await admin(() => api.createInvite(hours, multi));
      if (invite) await copy(invite.code);
    });
  }

  return (
    <Column gap="md">
      <Text class="title">
        <Trans>Invites</Trans>
      </Text>
      <Text class="body">
        <Trans>
          Sign-up on this server is by invitation. Make a link and send it to
          the person.
        </Trans>
      </Text>

      <Text class="label">
        <Trans>The link works for</Trans>
      </Text>
      <Buttons>
        <For each={[...ADMIN_INVITE_TTL_HOURS]}>
          {(hours) => (
            <Button
              size="sm"
              variant={ttl() === hours ? "filled" : "tonal"}
              aria-pressed={ttl() === hours}
              onPress={() => setTtl(hours)}
            >
              <Trans>{hours} h</Trans>
            </Button>
          )}
        </For>
      </Buttons>
      <Checkbox
        name="admin-invite-multi"
        checked={multiUse()}
        onChange={(e) => setMultiUse(e.currentTarget.checked)}
      >
        <Trans>Several people can sign up with it until it expires</Trans>
      </Checkbox>
      <Buttons>
        <Button size="sm" isDisabled={busy()} onPress={() => void create()}>
          <Trans>Create and copy link</Trans>
        </Button>
      </Buttons>

      <Show when={failure()}>
        {(failed) => (
          <Notice kind="error">{props.failureText(failed())}</Notice>
        )}
      </Show>

      <Switch>
        <Match when={invites.loading}>
          <CircularProgress />
        </Match>
        <Match when={invites.error}>
          <Notice kind="error">
            {props.failureText(adminFailure(invites.error))}
          </Notice>
        </Match>
        <Match when={invites()?.length === 0}>
          <Text class="label">
            <Trans>No active invites.</Trans>
          </Text>
        </Match>
        <Match when={invites()}>
          {(list) => (
            <For each={list()}>
              {(invite) => (
                <InviteCard data-invite={invite.code}>
                  <div>
                    <strong>{shortCode(invite.code)}</strong>{" "}
                    <Text class="label">
                      <Show
                        when={invite.multiUse}
                        fallback={<Trans>single use</Trans>}
                      >
                        <Trans>multi-use</Trans>
                      </Show>
                      {" · "}
                      <Trans>
                        expires{" "}
                        <Time value={invite.expiresAt} format="relative" />
                      </Trans>
                      {" · "}
                      <UsesText uses={invite.uses} />
                    </Text>
                  </div>
                  <Buttons>
                    <Button
                      size="sm"
                      variant="text"
                      onPress={() => void copy(invite.code)}
                    >
                      <Trans>Copy</Trans>
                    </Button>
                    <Button
                      size="sm"
                      variant="text"
                      isDisabled={busy()}
                      onPress={() => setRevoke(invite)}
                    >
                      <Trans>Revoke</Trans>
                    </Button>
                  </Buttons>
                </InviteCard>
              )}
            </For>
          )}
        </Match>
      </Switch>

      <Dialog
        show={!!revoke()}
        onClose={() => setRevoke(undefined)}
        title={<Trans>Revoke this invite?</Trans>}
        actions={[
          { text: <Trans>Cancel</Trans> },
          {
            text: <Trans>Revoke</Trans>,
            onClick: () => {
              const invite = revoke();
              if (invite) {
                const api = client().admin;
                void run(() => admin(() => api.revokeInvite(invite.code)));
              }
            },
          },
        ]}
      >
        <Trans>
          Nobody can sign up with the link any more. Accounts already made with
          it stay.
        </Trans>
      </Dialog>
    </Column>
  );
}

/**
 * How many accounts were made with an invite
 */
function UsesText(props: { uses: number }) {
  // eslint-disable-next-line solid/reactivity
  const uses = props.uses;
  return <Trans>accounts made: {uses}</Trans>;
}

const InviteCard = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "var(--gap-md)",
    padding: "var(--gap-md)",
    borderRadius: "var(--borderRadius-md)",
    background: "var(--md-sys-color-surface-container-high)",
  },
});
