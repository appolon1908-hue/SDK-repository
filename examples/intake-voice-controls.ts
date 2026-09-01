import {
  VoiceControlController,
  createSameOriginVoiceTransport,
  mountVoiceControls,
} from "@codestra/intake-voice-controls";

const root = document.querySelector<HTMLElement>("#voice-controls");
if (!root) throw new Error("Missing voice-controls root");

const tenantId = "tenant-from-server-rendered-config";
const controller = new VoiceControlController(
  {
    tenantId,
    siteId: "site-from-server-rendered-config",
    campaignId: "campaign-from-server-rendered-config",
    locale: navigator.language,
  },
  {
    transport: createSameOriginVoiceTransport({ tenantId }),
  },
);

mountVoiceControls(root, controller);

// For realtime media/signaling, inject the communication voice SDK as VoiceTransport.
// Do not place SIP/provider credentials or service-account secrets in this browser bundle.
