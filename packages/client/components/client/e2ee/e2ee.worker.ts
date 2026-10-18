// The crypto worker of one account (dur.io, plan WEB-03): the wasm core and its
// IndexedDB store live here only; the page talks to it through `StoatCrypto`.
import { serveCryptoWorker } from "@durio/stoat-crypto/worker";

serveCryptoWorker();
