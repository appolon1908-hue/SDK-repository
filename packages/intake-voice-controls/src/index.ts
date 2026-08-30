export type VoiceSessionState = "idle" | "requesting_permission" | "ready" | "connecting" | "connected" | "muted" | "ending" | "ended" | "error";

export interface VoiceSessionContext {
  tenantId: string;
  siteId: string;
  campaignId?: string;
  conversationId?: string;
  locale?: string;
  metadata?: Record<string, unknown>;
}

export interface VoiceSessionStartResult {
  sessionId: string;
  conversationId?: string;
}

export interface VoiceTransport {
  start(context: VoiceSessionContext): Promise<VoiceSessionStartResult>;
  attachStream?(sessionId: string, stream: MediaStream): Promise<void>;
  setMuted?(sessionId: string, muted: boolean): Promise<void>;
  stop(sessionId: string, reason?: string): Promise<void>;
}

export interface VoiceControlOptions {
  transport: VoiceTransport;
  mediaDevices?: Pick<MediaDevices, "getUserMedia">;
  audioConstraints?: MediaTrackConstraints | boolean;
}

export interface VoiceControlSnapshot {
  state: VoiceSessionState;
  sessionId?: string;
  conversationId?: string;
  muted: boolean;
  microphoneGranted: boolean;
  error?: string;
}

export class VoiceControlController {
  private stream?: MediaStream;
  private sessionId?: string;
  private conversationId?: string;
  private muted = false;
  private microphoneGranted = false;
  private state: VoiceSessionState = "idle";
  private error?: string;
  private readonly listeners = new Set<(snapshot: VoiceControlSnapshot) => void>();
  private readonly mediaDevices?: Pick<MediaDevices, "getUserMedia">;

  constructor(private readonly context: VoiceSessionContext, private readonly options: VoiceControlOptions) {
    this.mediaDevices = options.mediaDevices ?? globalThis.navigator?.mediaDevices;
  }

  snapshot(): VoiceControlSnapshot {
    return {
      state: this.state,
      sessionId: this.sessionId,
      conversationId: this.conversationId,
      muted: this.muted,
      microphoneGranted: this.microphoneGranted,
      error: this.error,
    };
  }

  subscribe(listener: (snapshot: VoiceControlSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  async requestMicrophone(): Promise<void> {
    if (!this.mediaDevices?.getUserMedia) throw new Error("Microphone access is unavailable in this browser.");
    this.transition("requesting_permission");
    try {
      this.stream = await this.mediaDevices.getUserMedia({ audio: this.options.audioConstraints ?? true, video: false });
      this.microphoneGranted = true;
      this.transition("ready");
    } catch (error) {
      this.fail(error, "Microphone permission was not granted.");
      throw error;
    }
  }

  async start(): Promise<VoiceSessionStartResult> {
    if (!this.stream) await this.requestMicrophone();
    this.transition("connecting");
    try {
      const started = await this.options.transport.start(this.context);
      this.sessionId = started.sessionId;
      this.conversationId = started.conversationId ?? this.context.conversationId;
      if (this.options.transport.attachStream && this.stream) {
        await this.options.transport.attachStream(started.sessionId, this.stream);
      }
      this.transition("connected");
      return started;
    } catch (error) {
      this.stopTracks();
      this.fail(error, "Unable to start the voice session.");
      throw error;
    }
  }

  async setMuted(muted: boolean): Promise<void> {
    if (!this.sessionId || !["connected", "muted"].includes(this.state)) throw new Error("Voice session is not connected.");
    for (const track of this.stream?.getAudioTracks() ?? []) track.enabled = !muted;
    if (this.options.transport.setMuted) await this.options.transport.setMuted(this.sessionId, muted);
    this.muted = muted;
    this.transition(muted ? "muted" : "connected");
  }

  async toggleMute(): Promise<void> { await this.setMuted(!this.muted); }

  async end(reason = "user_ended"): Promise<void> {
    if (this.state === "ended" || this.state === "idle") {
      this.stopTracks();
      this.transition("ended");
      return;
    }
    this.transition("ending");
    try {
      if (this.sessionId) await this.options.transport.stop(this.sessionId, reason);
    } finally {
      this.stopTracks();
      this.muted = false;
      this.transition("ended");
    }
  }

  dispose(): void {
    this.stopTracks();
    this.listeners.clear();
  }

  private stopTracks(): void {
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = undefined;
  }
  private transition(state: VoiceSessionState): void {
    this.state = state;
    if (state !== "error") this.error = undefined;
    this.emit();
  }
  private fail(error: unknown, fallback: string): void {
    this.state = "error";
    this.error = error instanceof Error ? error.message : fallback;
    this.emit();
  }
  private emit(): void { const snapshot = this.snapshot(); for (const listener of this.listeners) listener(snapshot); }
}

export interface VoiceButtonLabels {
  start?: string;
  mute?: string;
  unmute?: string;
  end?: string;
}

export function mountVoiceControls(
  root: HTMLElement,
  controller: VoiceControlController,
  labels: VoiceButtonLabels = {},
): () => void {
  const doc = root.ownerDocument;
  const container = doc.createElement("div");
  container.setAttribute("role", "group");
  container.setAttribute("aria-label", "Voice controls");

  const start = doc.createElement("button");
  start.type = "button";
  start.textContent = labels.start ?? "Start voice";
  const mute = doc.createElement("button");
  mute.type = "button";
  mute.textContent = labels.mute ?? "Mute";
  mute.disabled = true;
  const end = doc.createElement("button");
  end.type = "button";
  end.textContent = labels.end ?? "End voice";
  end.disabled = true;
  const status = doc.createElement("div");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const onStart = () => { void controller.start(); };
  const onMute = () => { void controller.toggleMute(); };
  const onEnd = () => { void controller.end(); };
  start.addEventListener("click", onStart);
  mute.addEventListener("click", onMute);
  end.addEventListener("click", onEnd);

  const unsubscribe = controller.subscribe((snapshot) => {
    status.textContent = humanStatus(snapshot);
    const active = snapshot.state === "connected" || snapshot.state === "muted";
    start.disabled = snapshot.state === "requesting_permission" || snapshot.state === "connecting" || active || snapshot.state === "ending";
    mute.disabled = !active;
    end.disabled = !active && snapshot.state !== "connecting";
    mute.textContent = snapshot.muted ? (labels.unmute ?? "Unmute") : (labels.mute ?? "Mute");
  });

  container.append(start, mute, end, status);
  root.replaceChildren(container);
  return () => {
    unsubscribe();
    start.removeEventListener("click", onStart);
    mute.removeEventListener("click", onMute);
    end.removeEventListener("click", onEnd);
    controller.dispose();
    root.replaceChildren();
  };
}

export interface IntakeVoiceTransportOptions {
  endpoint?: string;
  fetchImpl?: typeof fetch;
  tenantId: string;
}

export function createSameOriginVoiceTransport(options: IntakeVoiceTransportOptions): VoiceTransport {
  const endpoint = options.endpoint ?? "/api/codestra/voice/session";
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async start(context) {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-ID": options.tenantId },
        body: JSON.stringify({ ...context, source: "voice" }),
      });
      if (!response.ok) throw new Error(`Voice session start failed (${response.status})`);
      return await response.json() as VoiceSessionStartResult;
    },
    async stop(sessionId, reason) {
      const response = await fetchImpl(`${endpoint}/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "X-Tenant-ID": options.tenantId },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok && response.status !== 404) throw new Error(`Voice session stop failed (${response.status})`);
    },
  };
}

function humanStatus(snapshot: VoiceControlSnapshot): string {
  switch (snapshot.state) {
    case "requesting_permission": return "Requesting microphone permission…";
    case "ready": return "Microphone ready.";
    case "connecting": return "Connecting voice session…";
    case "connected": return "Voice connected.";
    case "muted": return "Microphone muted.";
    case "ending": return "Ending voice session…";
    case "ended": return "Voice session ended.";
    case "error": return snapshot.error ?? "Voice session error.";
    default: return "Voice ready to start.";
  }
}
