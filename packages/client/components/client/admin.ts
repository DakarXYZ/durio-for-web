// Whether the account is an admin of its instance (dur.io): `GET /admin/@me`, asked once
// per client in the background. The "Administration" settings page shows only for admins;
// the server checks every admin call itself.
import { type Accessor, createSignal } from "solid-js";

import type { Client } from "stoat.js";

const known = new WeakMap<Client, Accessor<boolean>>();

/**
 * Admin status of the client's account, `false` until the server answered
 * @param client Client (logged in)
 */
export function instanceAdmin(client: Client): Accessor<boolean> {
  let admin = known.get(client);
  if (!admin) {
    const [get, set] = createSignal(false);
    known.set(client, (admin = get));
    client.admin.status().then(set, () => {
      // no answer: ask again the next time
      known.delete(client);
    });
  }

  return admin;
}
