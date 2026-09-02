#!/usr/bin/env node

// Deprecated compatibility entry point. The canonical validator lives beside
// this directory under orbit-validate and receives the original process.argv.
await import("../orbit-validate/validate.mjs");
