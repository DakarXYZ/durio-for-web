#!/usr/bin/env node
/* global process, console */
// Download the RNNoise worklet for the desktop build (see rnnoise.mjs)
import { fetchRnnoise } from "./rnnoise.mjs";

fetchRnnoise().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
