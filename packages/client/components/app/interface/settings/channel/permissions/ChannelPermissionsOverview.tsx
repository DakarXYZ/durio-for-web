import { For, Show, createMemo, createSignal, onMount } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { Channel } from "stoat.js";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import {
  Avatar,
  CategoryButton,
  Column,
  Text,
  TextField,
  typography,
} from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { useSettingsNavigation } from "../../Settings";

/**
 * Count set bits
 * @param v Number
 * @returns Set bits
 */
function countBits(v: bigint) {
  let bits = 0;
  for (let i = 0n; i < 52n; i++) {
    if (((1n << i) & v) === 1n << i) {
      bits++;
    }
  }

  return bits;
}

/**
 * Menu to select what permission set to change
 */
export function ChannelPermissionsOverview(props: { context: Channel }) {
  const { navigate } = useSettingsNavigation();

  const roles = createMemo(() => {
    const ordered = props.context.server?.orderedRoles;

    return {
      overrides: ordered?.filter(
        (role) =>
          countBits(props.context.rolePermissions?.[role.id]?.a || 0n) > 0 ||
          countBits(props.context.rolePermissions?.[role.id]?.d || 0n) > 0,
      ),
      withoutOverrides: ordered?.filter(
        (role) =>
          countBits(props.context.rolePermissions?.[role.id]?.a || 0n) === 0 &&
          countBits(props.context.rolePermissions?.[role.id]?.d || 0n) === 0,
      ),
    };
  });

  return (
    <Column gap="lg">
      <CategoryButton
        icon={<Symbol size={20}>public</Symbol>}
        action="chevron"
        description={
          <Trans>Permissions available when no role overrides apply</Trans>
        }
        onClick={() => navigate("permissions/default")}
      >
        <Trans>Everyone</Trans>
      </CategoryButton>

      <MemberOverrides channel={props.context} />

      <Column gap="sm">
        <Text class="label">
          <Trans>Role Overrides</Trans>
        </Text>
        <Show
          when={roles().overrides?.length}
          fallback={
            <EmptyState>
              <Trans>No role overrides have been configured.</Trans>
            </EmptyState>
          }
        >
          <For each={roles().overrides}>
            {(role) => (
              <CategoryButton
                icon={
                  <RoleIcon
                    style={{
                      background: role.colour ?? "transparent",
                      border: role.colour
                        ? undefined
                        : "2px dashed var(--md-sys-color-on-surface-variant)",
                    }}
                  />
                }
                iconBackground={!!role.colour}
                action="chevron"
                onClick={() => navigate(`permissions/${role.id}`)}
                description={
                  <Trans>
                    Grants{" "}
                    {countBits(props.context.rolePermissions![role.id].a)}{" "}
                    permissions and denies{" "}
                    {countBits(props.context.rolePermissions![role.id].d)}{" "}
                    permissions
                  </Trans>
                }
              >
                {role.name}
              </CategoryButton>
            )}
          </For>
        </Show>
      </Column>

      <Column gap="sm">
        <Text class="label">
          <Trans>Roles with No Overrides</Trans>
        </Text>
        <Show
          when={roles().withoutOverrides?.length}
          fallback={
            <EmptyState>
              <Trans>All roles have overrides.</Trans>
            </EmptyState>
          }
        >
          <For each={roles().withoutOverrides}>
            {(role) => (
              <CategoryButton
                icon={
                  <RoleIcon
                    style={{
                      background: role.colour ?? "transparent",
                      border: role.colour
                        ? undefined
                        : "2px dashed var(--md-sys-color-on-surface-variant)",
                    }}
                  />
                }
                iconBackground={!!role.colour}
                action="chevron"
                onClick={() => navigate(`permissions/${role.id}`)}
                description={<Trans>No permissions set yet</Trans>}
              >
                {role.name}
              </CategoryButton>
            )}
          </For>
        </Show>
      </Column>
    </Column>
  );
}

/**
 * dur.io: permissions of single members, for example read-only or no reactions
 */
function MemberOverrides(props: { channel: Channel }) {
  const { t } = useLingui();
  const client = useClient();
  const { navigate } = useSettingsNavigation();
  const [query, setQuery] = createSignal("");

  // the member list, to find members by name
  onMount(() => void props.channel.server?.fetchMembers().catch(() => {}));

  const member = (userId: string) =>
    client().serverMembers.getByKey({
      server: props.channel.serverId,
      user: userId,
    });

  const overrides = createMemo(() =>
    Object.keys(props.channel.userPermissions ?? {}),
  );

  const matches = createMemo(() => {
    const search = query().trim().toLowerCase();
    if (!search) return [];

    return client()
      .serverMembers.filter(
        (entry) =>
          entry.id.server === props.channel.serverId &&
          !overrides().includes(entry.id.user) &&
          [entry.displayName, entry.user?.username]
            .filter(Boolean)
            .some((name) => name!.toLowerCase().includes(search)),
      )
      .slice(0, 8);
  });

  return (
    <Column gap="sm">
      <Text class="label">
        <Trans>Member Overrides</Trans>
      </Text>
      <For
        each={overrides()}
        fallback={
          <EmptyState>
            <Trans>
              No member has permissions of their own here. Find a member to make
              the channel read-only for them or take away reactions.
            </Trans>
          </EmptyState>
        }
      >
        {(userId) => (
          <CategoryButton
            icon={
              <Avatar
                size={24}
                src={member(userId)?.animatedAvatarURL}
                fallback={member(userId)?.displayName}
              />
            }
            action="chevron"
            onClick={() => navigate(`permissions/user/${userId}`)}
            description={
              <Trans>
                Grants {countBits(props.channel.userPermissions![userId].a)}{" "}
                permissions and denies{" "}
                {countBits(props.channel.userPermissions![userId].d)}{" "}
                permissions
              </Trans>
            }
          >
            {member(userId)?.displayName ??
              client().users.get(userId)?.displayName ??
              userId}
          </CategoryButton>
        )}
      </For>
      <TextField
        variant="filled"
        placeholder={t`Find a member`}
        value={query()}
        onInput={(event) => setQuery(event.currentTarget.value)}
      />
      <For each={matches()}>
        {(entry) => (
          <CategoryButton
            icon={
              <Avatar
                size={24}
                src={entry.animatedAvatarURL}
                fallback={entry.displayName}
              />
            }
            action="chevron"
            onClick={() => navigate(`permissions/user/${entry.id.user}`)}
            description={entry.user?.username}
          >
            {entry.displayName}
          </CategoryButton>
        )}
      </For>
    </Column>
  );
}

const RoleIcon = styled("div", {
  base: {
    width: "100%",
    height: "100%",
    aspectRatio: "1/1",
    borderRadius: "100%",
  },
});

const EmptyState = styled("span", {
  base: {
    color: "var(--md-sys-color-on-surface-variant)",
    ...typography.raw({ class: "body", size: "medium" }),
  },
});
