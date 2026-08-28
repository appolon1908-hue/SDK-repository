// Pulls in @types/react's "canary" type augmentation so `<form action={fn}>`
// (a Server Action reference) type-checks. Real Next.js apps get this
// transitively through next-env.d.ts's `/// <reference types="next" />`;
// this package builds standalone with `tsc`, so it needs the reference
// directly.
/// <reference types="react/canary" />
