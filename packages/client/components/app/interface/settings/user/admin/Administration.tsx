import {
  For,
  Match,
  Show,
  Switch,
  createResource,
  createSignal,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { API, AdminSession } from "stoat.js";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { Buttons, Notice } from "@revolt/client/e2ee/ui/parts";
import {
  Button,
  CircularProgress,
  Column,
  Dialog,
  Text,
  TextField,
  Time,
} from "@revolt/ui";

import { type AdminFailure, adminFailure, userTag } from "./logic";

type Confirm = { user: API.AdminUser; session?: AdminSession };

/**
 * Why an admin call failed, in words
 */
function FailureText(props: { failure: AdminFailure; ending?: boolean }) {
  return (
    <Switch fallback={<Trans>Something went wrong. Try again.</Trans>}>
      <Match when={props.failure === "notFound" && props.ending}>
        <Trans>The session has already ended.</Trans>
      </Match>
      <Match when={props.failure === "notFound"}>
        <Trans>The user no longer exists.</Trans>
      </Match>
      <Match when={props.failure === "forbidden"}>
        <Trans>Only administrators can do this.</Trans>
      </Match>
      <Match when={props.failure === "bot"}>
        <Trans>Bots have no sessions.</Trans>
      </Match>
      <Match when={props.failure === "network"}>
        <Trans>The server did not answer. Check the connection.</Trans>
      </Match>
    </Switch>
  );
}

/**
 * "Administration" (dur.io): an admin of the instance finds a user and ends their
 * sessions, e.g. after a lost phone. Only shown to admins (`GET /admin/@me`); the server
 * checks every call.
 */
export default function Administration() {
  const client = useClient();
  const { t } = useLingui();

  const [query, setQuery] = createSignal("");
  const [searching, setSearching] = createSignal(false);
  const [searchFailure, setSearchFailure] = createSignal<AdminFailure>();
  const [notFound, setNotFound] = createSignal(false);
  const [user, setUser] = createSignal<API.AdminUser>();

  const [sessions, { refetch }] = createResource(
    () => (user() && !user()!.bot ? user()!._id : undefined),
    (id) => client().admin.sessions(id),
  );

  const [confirm, setConfirm] = createSignal<Confirm>();
  const [ending, setEnding] = createSignal(false);
  const [endFailure, setEndFailure] = createSignal<AdminFailure>();

  async function search() {
    if (!query().trim() || searching()) return;
    setSearching(true);
    setSearchFailure(undefined);
    setEndFailure(undefined);
    setNotFound(false);
    try {
      const found = await client().admin.findUser(query());
      setUser(found);
      setNotFound(!found);
    } catch (e) {
      setUser(undefined);
      setSearchFailure(adminFailure(e));
    } finally {
      setSearching(false);
    }
  }

  async function end(target: Confirm) {
    setEnding(true);
    setEndFailure(undefined);
    try {
      if (target.session)
        await client().admin.endSession(target.user._id, target.session.id);
      else await client().admin.endAllSessions(target.user._id);
    } catch (e) {
      setEndFailure(adminFailure(e));
    } finally {
      setEnding(false);
      setConfirm(undefined);
      void refetch();
    }
  }

  const isThisDevice = (session: AdminSession) =>
    user()?._id === client().user?.id && session.id === client().sessionId;

  return (
    <Column gap="lg">
      <Text class="body">
        <Trans>
          Find a user by id or by name with its number (name#1234) to see where
          they are signed in. End a session when a device is lost or stolen.
        </Trans>
      </Text>

      <SearchRow>
        <TextField
          name="admin-query"
          label={t`User id or name#1234`}
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && void search()}
          enterkeyhint="search"
        />
        <Button
          size="sm"
          variant="tonal"
          isDisabled={searching() || !query().trim()}
          onPress={() => void search()}
        >
          <Trans>Find</Trans>
        </Button>
      </SearchRow>

      <Switch>
        <Match when={searching()}>
          <CircularProgress />
        </Match>
        <Match when={searchFailure()}>
          {(failure) => (
            <Notice kind="error">
              <FailureText failure={failure()} />
            </Notice>
          )}
        </Match>
        <Match when={notFound()}>
          <Notice>
            <Trans>No user with this id or name.</Trans>
          </Notice>
        </Match>
        <Match when={user()}>
          {(found) => (
            <Column gap="md">
              <div>
                <Text class="title">
                  {found().display_name ?? found().username}
                </Text>
                <Text class="label">
                  {userTag(found())} · {found()._id}
                </Text>
              </div>

              <Show when={endFailure()}>
                {(failure) => (
                  <Notice kind="error">
                    <FailureText failure={failure()} ending />
                  </Notice>
                )}
              </Show>

              <Switch>
                <Match when={found().bot}>
                  <Notice>
                    <Trans>Bots have no sessions.</Trans>
                  </Notice>
                </Match>
                <Match when={sessions.loading}>
                  <CircularProgress />
                </Match>
                <Match when={sessions.error}>
                  <Notice kind="error">
                    <FailureText failure={adminFailure(sessions.error)} />
                  </Notice>
                </Match>
                <Match when={sessions()?.length === 0}>
                  <Notice>
                    <Trans>The user is not signed in anywhere.</Trans>
                  </Notice>
                </Match>
                <Match when={sessions()}>
                  {(list) => (
                    <>
                      <For each={list()}>
                        {(session) => (
                          <SessionCard>
                            <div>
                              <strong>{session.name}</strong>
                              <Show when={isThisDevice(session)}>
                                {" "}
                                <Text class="label">
                                  <Trans>(this device)</Trans>
                                </Text>
                              </Show>
                              <Text class="label">
                                <Show
                                  when={session.lastSeen}
                                  fallback={
                                    <Trans>
                                      Signed in{" "}
                                      <Time
                                        value={session.createdAt}
                                        format="relative"
                                      />
                                    </Trans>
                                  }
                                >
                                  {(seen) => (
                                    <Trans>
                                      Last seen{" "}
                                      <Time value={seen()} format="relative" />
                                    </Trans>
                                  )}
                                </Show>
                              </Text>
                            </div>
                            <Button
                              size="sm"
                              variant="text"
                              isDisabled={ending()}
                              onPress={() =>
                                setConfirm({ user: found(), session })
                              }
                            >
                              <Trans>End session</Trans>
                            </Button>
                          </SessionCard>
                        )}
                      </For>
                      <Buttons>
                        <Button
                          size="sm"
                          variant="_error"
                          isDisabled={ending()}
                          onPress={() => setConfirm({ user: found() })}
                        >
                          <Trans>End all sessions</Trans>
                        </Button>
                      </Buttons>
                    </>
                  )}
                </Match>
              </Switch>
            </Column>
          )}
        </Match>
      </Switch>

      <Dialog
        show={!!confirm()}
        onClose={() => !ending() && setConfirm(undefined)}
        title={
          confirm()?.session ? (
            <Trans>End this session?</Trans>
          ) : (
            <Trans>End all sessions of this user?</Trans>
          )
        }
        actions={[
          { text: <Trans>Cancel</Trans> },
          {
            text: confirm()?.session ? (
              <Trans>End session</Trans>
            ) : (
              <Trans>End all sessions</Trans>
            ),
            onClick: () => {
              const target = confirm();
              if (target) void end(target);
              return false;
            },
          },
        ]}
        isDisabled={ending()}
      >
        <Show when={confirm()} keyed>
          {(target) => <ConfirmText {...target} />}
        </Show>
      </Dialog>
    </Column>
  );
}

/**
 * What ending sessions does, for the confirmation
 */
function ConfirmText(props: Confirm) {
  // eslint-disable-next-line solid/reactivity
  const name = userTag(props.user);
  // eslint-disable-next-line solid/reactivity
  const device = props.session?.name;

  return (
    <Column>
      <span>
        {device ? (
          <Trans>
            {name} is logged out on “{device}”.
          </Trans>
        ) : (
          <Trans>{name} is logged out on every device.</Trans>
        )}
      </span>
      <span>
        <Trans>
          The end-to-end encryption devices of these sessions are removed: the
          user has to sign in again, and can read earlier encrypted messages
          only from their key backup or another signed-in device.
        </Trans>
      </span>
    </Column>
  );
}

const SearchRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-md)",
    "& > :first-child": { flexGrow: 1 },
  },
});

const SessionCard = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--gap-md)",
    padding: "var(--gap-md)",
    borderRadius: "var(--borderRadius-md)",
    background: "var(--md-sys-color-surface-container-high)",
  },
});
