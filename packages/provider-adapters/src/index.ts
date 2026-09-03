export {
  DEFAULT_RESTRICTED_GATEWAY_ROUTES,
  RestrictedGatewayAdapter,
  canonicalEvent,
  createManifest,
} from "./base.js";
export type {
  RestrictedGatewayAdapterConfig,
  RestrictedGatewayRoutes,
  WebhookNormalizer,
} from "./base.js";
export { PostizAdapter } from "./postiz.js";
export { OdooAdapter } from "./odoo.js";
export { KlyrowAdapter } from "./klyrow.js";
export { TelnexaAdapter } from "./telnexa.js";
export { VicidialAdapter } from "./vicidial.js";
