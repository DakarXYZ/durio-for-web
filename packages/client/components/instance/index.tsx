import { useLingui } from "@lingui/solid/macro";
import { useBeforeLeave, useNavigate, useParams } from "@solidjs/router";
import {
  createContext,
  createMemo,
  createSignal,
  JSXElement,
  onCleanup,
  Show,
  useContext,
} from "solid-js";
import { Dynamic } from "solid-js/web";

import { CONFIGURATION } from "@revolt/common";
import {
  AppConfig,
  normalizeHost,
  routerPath,
  STOAT_HOST,
} from "@revolt/common/lib/env";
import { LoadingScreen, useSnackbar } from "@revolt/ui";

import Instance, { _newClient } from "./Instance";
import { CONNECT_PATH, discoverInstance, lastSessionHost } from "./servers";

export { onClientDispose } from "./dispose";
export { CONNECT_PATH } from "./servers";

export const StoatOrigin = new URL(`https://${STOAT_HOST}`).origin;
/** Host of the default instance, empty when the build has none (O13) */
export const DefaultHost = CONFIGURATION.DEFAULT_HOST;
const DefRoute = DefaultHost && `/i/${DefaultHost}/`;

const instanceContext = createContext<Instance>();
let appLoadedOnce = false;

export function InstanceContext(props: { children?: JSXElement }) {
  const params = useParams();
  const host = createMemo(() => normalizeHost(params.host));

  //Switching instance remounts everything below: state, client and socket
  return (
    <Show when={[host()]} keyed>
      {([host]) => <HostContext host={host}>{props.children}</HostContext>}
    </Show>
  );
}

function HostContext(props: { host: string; children?: JSXElement }) {
  const snackbar = useSnackbar();
  const nav = useNavigate();
  const { t } = useLingui();

  const [inst, setInst] = createSignal<Instance>();
  onCleanup(() => inst()?.dispose());

  //Check Stoat instance (keyed by InstanceContext, never changes)
  // eslint-disable-next-line solid/reactivity
  const host = props.host;

  function onError(e: unknown) {
    if ((e as Error).message === "Failed to fetch") {
      const hStr = `'${host || DefaultHost}'`;
      e = t`Couldn't fetch dur.io configuration from ${hStr}.`;
    }
    snackbar.showError(e);
    if (appLoadedOnce) nav(-1);
  }

  (async () => {
    //Redirect default instance
    if (host && host === DefaultHost)
      return nav(Instance.relPath(), { replace: true });

    //No default instance: continue with the last account, else ask for a server
    if (!host && !DefaultHost) {
      const last = lastSessionHost();
      return nav(last ? `/i/${last}${Instance.relPath()}` : CONNECT_PATH, {
        replace: true,
      });
    }

    try {
      const appCfg: AppConfig =
        host || !CONFIGURATION.DEFAULT_API_URL
          ? await discoverInstance(host || DefaultHost)
          : { api: CONFIGURATION.DEFAULT_API_URL };

      const cli = _newClient(appCfg.api);
      await cli.initConfig();
      setInst(new Instance(appCfg, cli, host, nav));
    } catch (e) {
      onError(e);
    }
    appLoadedOnce = true;
  })();

  //Finish init in reactive scope
  const instInit = createMemo(() => {
    const i = inst();
    if (i) i._init();
    return i;
  });

  return (
    <Show
      when={instInit()}
      fallback={
        <LoadingScreen isStoat={(host || DefaultHost) === STOAT_HOST} />
      }
    >
      <Dynamic component={instanceContext.Provider} value={instInit()}>
        <Redirect />
        {props.children}
      </Dynamic>
    </Show>
  );
}

const DEF_MARK = "_defInst";

function Redirect() {
  const inst = useInstance(),
    nav = useNavigate();

  useBeforeLeave((e) => {
    if (typeof e.to !== "string") return;
    // dur.io: resolved paths carry the server build's /web/app
    const to = routerPath(e.to);

    if (DefRoute && (to + "/").startsWith(DefRoute)) {
      //Redirect default instance
      e.preventDefault();
      nav(Instance.relPath(to), { state: DEF_MARK });
    } else if (
      inst.host &&
      !to.startsWith("/i/") &&
      !to.startsWith(CONNECT_PATH) &&
      e.options?.state !== DEF_MARK
    ) {
      //Redirect relative path to instance path
      e.preventDefault();
      nav(inst.href(to, true));
    }
  });

  return <></>;
}

export const useInstance = () => useContext(instanceContext)!;
