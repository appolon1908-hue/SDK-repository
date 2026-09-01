# @codestra/intake-voice-controls

Browser-safe microphone and voice-session controls for Codestra sites.

## Controls

- request microphone permission
- start a voice session
- mute / unmute
- end a voice session
- accessible live status
- injected realtime media transport
- same-origin control-plane transport helper

## Security boundary

The browser never receives Keycloak client secrets, SIP credentials, provider API keys, Kong credentials, or direct Middleware credentials. The default control-plane helper calls a same-origin BFF route. That BFF must traverse Caddy -> Kong -> Middleware.

Realtime media transport is injected through `VoiceTransport`. This allows the communication/voice SDK to own WebRTC or provider-specific media while intake owns lead/campaign/conversation correlation and controls.

The package does not authorize PSTN dialing and does not enable production calling.
