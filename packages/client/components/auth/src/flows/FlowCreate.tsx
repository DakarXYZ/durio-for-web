import { Trans } from "@lingui/solid/macro";
import { Show, createSignal } from "solid-js";
import { styled } from "styled-system/jsx";

import { useApi, useClientLifecycle } from "@revolt/client";
import {
  parseInvite,
  sameHost,
  serverHost,
} from "@revolt/common/lib/inviteLink";
import { useInstance } from "@revolt/instance";
import { useModals } from "@revolt/modal";
import { A, useNavigate, useParams } from "@revolt/routing";
import { Button, iconSize } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import MdArrowBack from "@material-design-icons/svg/filled/arrow_back.svg?component-solid";

import { FlowTitle } from "./Flow";
import { setFlowCheckEmail } from "./FlowCheck";
import { Fields, Form } from "./Form";

const BackAction = styled("div", {
  base: {
    width: "100%",

    "& a, & button": {
      width: "100%",
    },

    "& button": {
      gap: "4px",
    },
  },
});

/**
 * The pasted invite link belongs to another server
 */
function OtherServer(props: { link: string; here: string }) {
  // eslint-disable-next-line solid/reactivity
  const { link, here } = props;
  return (
    <InviteHostWarning role="alert">
      <Trans>
        This invite link is for {link}, but you are signing up on {here}. Go
        back and choose that server to use it.
      </Trans>
    </InviteHostWarning>
  );
}

const InviteHostWarning = styled("p", {
  base: {
    margin: 0,
    fontSize: "0.85rem",
    color: "var(--md-sys-color-error)",
  },
});

/**
 * Reassurance shown while typing an email address to sign up with
 */
function EmailPrivacyHint() {
  return (
    <>
      <Symbol size={20}>lock</Symbol>
      <div>
        <strong>
          <Trans>Your email stays private</Trans>
        </strong>
        <p>
          <Trans>
            We only use it to verify your account and help you get back in if
            you're ever locked out. We'll never sell it or send you spam.
          </Trans>
        </p>
      </div>
    </>
  );
}

/**
 * What the invite field is for, while it has focus (dur.io)
 */
function InviteHint() {
  return (
    <>
      <Symbol size={20}>mail</Symbol>
      <div>
        <strong>
          <Trans>Sign-up is by invitation</Trans>
        </strong>
        <p>
          <Trans>
            Ask an admin of this server for an invite link and paste it here.
          </Trans>
        </p>
      </div>
    </>
  );
}

/**
 * Flow for creating a new account
 */
export default function FlowCreate() {
  const api = useApi();
  const navigate = useNavigate();
  const { code } = useParams();
  const modals = useModals();
  const { login } = useClientLifecycle();
  const { config, isStoat, apiUrl } = useInstance();

  // dur.io: a pasted invite link of another server (not switched automatically)
  const thisHost = serverHost(apiUrl);
  const [otherHost, setOtherHost] = createSignal<string>();
  const [serverInvite, setServerInvite] = createSignal(false);
  function onInviteInput(event: InputEvent) {
    const field = event.target as { name?: string; value?: string };
    if (field.name !== "invite") return;
    const parsed = parseInvite(field.value ?? "");
    setServerInvite(!!parsed?.serverInvite);
    const host = parsed?.serverInvite ? undefined : parsed?.host;
    setOtherHost(host && !sameHost(host, thisHost) ? host : undefined);
  }

  /**
   * Create an account
   * @param data Form Data
   */
  async function create(data: FormData) {
    const email = data.get("email") as string;
    const password = data.get("new-password") as string;
    const captcha = data.get("captcha") as string;
    // dur.io: the field takes the invite link too
    const rawInvite = (data.get("invite") as string | null) ?? "";
    const parsed = parseInvite(rawInvite);
    const invite =
      parsed && !parsed.serverInvite ? parsed.code : rawInvite.trim();

    await api.post("/auth/account/create", {
      email,
      password,
      captcha,
      ...(invite ? { invite } : {}),
    });

    if (!config.features.email) {
      await login({ email, password }, modals);
      navigate("/login/auth", { replace: true });
    } else {
      setFlowCheckEmail(email);
      navigate("/login/check", { replace: true });
    }
  }

  return (
    <>
      <FlowTitle
        subtitle={<Trans>Set up your account and make yourself at home.</Trans>}
      >
        <Trans>Join dur.io</Trans>
      </FlowTitle>
      <Form onSubmit={create} captcha={config.features.captcha.key}>
        <Fields
          fields={[
            // Stoat's privacy policy doesn't cover third party instances
            isStoat ? { field: "email", hint: <EmailPrivacyHint /> } : "email",
            "new-password",
          ]}
        />
        <Show when={config.features.invite_only}>
          <div onInput={onInviteInput}>
            <Fields
              fields={[{ field: "invite", value: code, hint: <InviteHint /> }]}
            />
          </div>
          <Show when={serverInvite()}>
            <InviteHostWarning role="alert">
              <Trans>
                This is an invite to a server (a community), not to sign up.
                Sign up with the invite link from an admin first, then open the
                server invite.
              </Trans>
            </InviteHostWarning>
          </Show>
          <Show when={otherHost()} keyed>
            {(host) => <OtherServer link={host} here={thisHost} />}
          </Show>
        </Show>
        <Button type="submit" size="md">
          <Trans>Create account</Trans>
        </Button>
        <BackAction>
          <A href="..">
            <Button variant="text">
              <MdArrowBack {...iconSize("1.2em")} /> <Trans>Back</Trans>
            </Button>
          </A>
        </BackAction>
      </Form>
      {import.meta.env.DEV && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            background: "white",
            color: "black",
            cursor: "pointer",
          }}
          onClick={() => {
            setFlowCheckEmail("insert@stoat.chat");
            navigate("/login/check", { replace: true });
          }}
        >
          Mock Submission
        </div>
      )}
    </>
  );
}
