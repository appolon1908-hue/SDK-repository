# Horizon compatibility alias

`@codestra/intake-ui/horizon` was the pre-release name for the Codestra shared visual system. **Codestra Orbit V2 is now the only design authority.**

Use:

```ts
import {
  applyOrbitShell,
  createOrbitBrandClient,
  mountOrbitFooter,
} from "@codestra/intake-ui/orbit";
import "@codestra/intake-ui/orbit/styles";
```

See [`ORBIT.md`](ORBIT.md) for the complete contract.

## Compatibility policy

The following exports remain temporarily available so existing adoption branches can migrate without a breaking import failure:

```text
@codestra/intake-ui/horizon
@codestra/intake-ui/horizon/styles
@codestra/intake-ui/horizon/tokens.css
@codestra/intake-ui/horizon/themes.css
@codestra/intake-ui/horizon/base.css
@codestra/intake-ui/horizon/components.css
```

They resolve to the Orbit black/white palette and restrained geometry. They do not preserve the abandoned blue-primary, light-mode, gradient, glow, large-radius, or shadow-heavy Horizon proposal.

## Required migration

1. Replace Horizon imports with Orbit imports.
2. Replace `data-horizon-*` root attributes with `data-orbit-*` declarations.
3. Replace `hz-*` classes with `cx-*` classes as each page is touched.
4. Add an `orbit/suite.json` manifest and run the shared Orbit validator.
5. Prove the built artifact contains no prohibited Horizon-only palette or decoration.
6. Remove compatibility use only after source, tests, documentation, screenshots, and runtime evidence use Orbit.

Do not begin new work with Horizon names. The compatibility layer is not a second design system and must not be customized independently.
