export const STOAT_HOST = "stoat.chat";

/** App `stoat.json` endpoint format */
export interface AppConfig {
  api: string;
}

/**
 * Fetch env var by name, optionally only when in dev mode.
 * Also prevents compiler from optimizing out injected strings in Docker
 */
const getEnv = (name: string, devOnly?: boolean) =>
  !devOnly || import.meta.env.DEV
    ? (import.meta.env[name] as string)
    : undefined;

/** Old and alternative names of the Stoat instance */
const STOAT_ALIASES = [
  // historically...
  "api.revolt.chat",
  "beta.revolt.chat",
  "revolt.chat",
  // ... and now:
  "api.stoat.chat",
  "beta.stoat.chat",
];

/**
 * Normalize a server address as typed by the user or found in a path to a host:
 * no scheme, path or default port, lowercase; Stoat aliases become STOAT_HOST
 */
export const normalizeHost = (host?: string) => {
  const normalized = (host ?? "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .split(/[/?#]/)[0]
    .replace(/:443$/, "");

  return STOAT_ALIASES.includes(normalized) ? STOAT_HOST : normalized;
};

// dur.io: no built-in server (O13). Without VITE_HOST the client starts at the server address
// screen; VITE_API_URL is optional, otherwise it's discovered via /.well-known/stoat
const DEFAULT_HOST = normalizeHost(
  getEnv("VITE_DEV_HOST", true) || getEnv("VITE_HOST"),
);

const DEFAULT_API_URL =
  getEnv("VITE_DEV_API_URL", true) || getEnv("VITE_API_URL") || "";

if (DEFAULT_API_URL && !DEFAULT_HOST)
  console.error("VITE_HOST required when VITE_API_URL is set!");

export default {
  /** Default instance (without the protocol), empty if none */
  DEFAULT_HOST,
  /** API URL of default instance, empty to discover it */
  DEFAULT_API_URL,
  /** WS server override for development */
  DEV_WS_URL: getEnv("VITE_DEV_WS_URL"),
  /** Media server override for development */
  DEV_MEDIA_URL: getEnv("VITE_DEV_MEDIA_URL"),
  /** Proxy server override for development */
  DEV_PROXY_URL: getEnv("VITE_DEV_PROXY_URL"),
  /** Gifbox server override for development */
  DEV_GIFBOX_URL: getEnv("VITE_DEV_GIFBOX_URL"),
  /**
   * RNNoise worklet CDN host location. Defaults to blank, which uses the url provided by the livekit-rnnoise-processor package.
   */
  // dur.io: the desktop build packages the worklet (WEB-11, no remote code)
  RNNOISE_WORKLET_CDN_URL:
    getEnv("VITE_RNNOISE_WORKLET_CDN_URL") ||
    (import.meta.env.MODE === "desktop"
      ? new URL("/rnnoise/", location.origin).href
      : undefined),
  /**
   * Session ID to set during development.
   */
  DEVELOPMENT_SESSION_ID: getEnv("VITE_SESSION_ID", true),
  /**
   * Token to set during development.
   */
  DEVELOPMENT_TOKEN: getEnv("VITE_TOKEN", true),
  /**
   * User ID to set during development.
   */
  DEVELOPMENT_USER_ID: getEnv("VITE_USER_ID", true),
};
