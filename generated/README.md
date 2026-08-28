# Generated SDK output

CI writes Python and PHP clients into this directory temporarily and uploads them as exact-SHA artifacts. Generated source is ignored by Git so reviews focus on the canonical contract and generator configuration.

Stable publication should occur from a protected release workflow that regenerates from the reviewed commit, tests the package, signs provenance, and publishes the immutable artifact. Do not publish a developer workstation's generated directory.
