import { describe, expect, it } from "vitest";
import { VoiceControlController, type VoiceTransport } from "../src/index.js";

function mediaFixture() {
  let stopped = false;
  const track = { enabled: true, stop: () => { stopped = true; } } as unknown as MediaStreamTrack;
  const stream = {
    getAudioTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;
  const mediaDevices = { getUserMedia: async () => stream } as Pick<MediaDevices, "getUserMedia">;
  return { stream, track, mediaDevices, stopped: () => stopped };
}

describe("voice control controller", () => {
  it("requests mic, starts, mutes and ends", async () => {
    const media = mediaFixture();
    const calls: string[] = [];
    const transport: VoiceTransport = {
      async start() { calls.push("start"); return { sessionId: "vs-1", conversationId: "c-1" }; },
      async attachStream() { calls.push("attach"); },
      async setMuted(_id, muted) { calls.push(`mute:${muted}`); },
      async stop() { calls.push("stop"); },
    };
    const controller = new VoiceControlController({ tenantId: "t-1", siteId: "site-1" }, { transport, mediaDevices: media.mediaDevices });
    await controller.start();
    expect(controller.snapshot().state).toBe("connected");
    await controller.setMuted(true);
    expect(controller.snapshot().state).toBe("muted");
    await controller.end();
    expect(controller.snapshot().state).toBe("ended");
    expect(media.stopped()).toBe(true);
    expect(calls).toEqual(["start", "attach", "mute:true", "stop"]);
  });

  it("fails closed when microphone permission fails", async () => {
    const transport: VoiceTransport = { async start() { return { sessionId: "unused" }; }, async stop() {} };
    const mediaDevices = { getUserMedia: async () => { throw new Error("denied"); } } as Pick<MediaDevices, "getUserMedia">;
    const controller = new VoiceControlController({ tenantId: "t-1", siteId: "site-1" }, { transport, mediaDevices });
    await expect(controller.start()).rejects.toThrow("denied");
    expect(controller.snapshot().state).toBe("error");
  });

  it("stops a session that resolves after the user already ended", async () => {
    const media = mediaFixture();
    const started = deferred<{ sessionId: string }>();
    const calls: string[] = [];
    const transport: VoiceTransport = {
      async start() { calls.push("start"); return started.promise; },
      async stop(sessionId, reason) { calls.push(`stop:${sessionId}:${reason}`); },
    };
    const controller = new VoiceControlController({ tenantId: "t-1", siteId: "site-1" }, { transport, mediaDevices: media.mediaDevices });

    const start = controller.start();
    await settled();
    const end = controller.end();
    started.resolve({ sessionId: "vs-late" });
    await start;
    await end;

    expect(controller.snapshot().state).toBe("ended");
    expect(calls).toEqual(["start", "stop:vs-late:user_ended"]);
  });

  it("stops the remote session if stream attachment fails", async () => {
    const media = mediaFixture();
    const calls: string[] = [];
    const transport: VoiceTransport = {
      async start() { calls.push("start"); return { sessionId: "vs-attach" }; },
      async attachStream() { calls.push("attach"); throw new Error("attach failed"); },
      async stop(sessionId, reason) { calls.push(`stop:${sessionId}:${reason}`); },
    };
    const controller = new VoiceControlController({ tenantId: "t-1", siteId: "site-1" }, { transport, mediaDevices: media.mediaDevices });

    await expect(controller.start()).rejects.toThrow("attach failed");

    expect(controller.snapshot().state).toBe("error");
    expect(calls).toEqual(["start", "attach", "stop:vs-attach:start_failed"]);
  });

  it("keeps failed stops retryable", async () => {
    const media = mediaFixture();
    let attempts = 0;
    const transport: VoiceTransport = {
      async start() { return { sessionId: "vs-retry" }; },
      async stop() {
        attempts += 1;
        if (attempts === 1) throw new Error("timeout");
      },
    };
    const controller = new VoiceControlController({ tenantId: "t-1", siteId: "site-1" }, { transport, mediaDevices: media.mediaDevices });
    await controller.start();

    await expect(controller.end()).rejects.toThrow("timeout");
    expect(controller.snapshot().state).toBe("error");
    await controller.end();

    expect(controller.snapshot().state).toBe("ended");
    expect(attempts).toBe(2);
  });

  it("stops a connected remote session during dispose", async () => {
    const media = mediaFixture();
    const calls: string[] = [];
    const transport: VoiceTransport = {
      async start() { return { sessionId: "vs-dispose" }; },
      async stop(sessionId, reason) { calls.push(`stop:${sessionId}:${reason}`); },
    };
    const controller = new VoiceControlController({ tenantId: "t-1", siteId: "site-1" }, { transport, mediaDevices: media.mediaDevices });
    await controller.start();

    await controller.dispose();

    expect(calls).toEqual(["stop:vs-dispose:disposed"]);
    expect(controller.snapshot().state).toBe("ended");
  });

  it("rolls back local track state when mute signaling fails", async () => {
    const media = mediaFixture();
    const transport: VoiceTransport = {
      async start() { return { sessionId: "vs-mute" }; },
      async setMuted(_sessionId, muted) { if (!muted) throw new Error("mute failed"); },
      async stop() {},
    };
    const controller = new VoiceControlController({ tenantId: "t-1", siteId: "site-1" }, { transport, mediaDevices: media.mediaDevices });
    await controller.start();
    await controller.setMuted(true);
    expect(media.track.enabled).toBe(false);

    await expect(controller.setMuted(false)).rejects.toThrow("mute failed");

    expect(media.track.enabled).toBe(false);
    expect(controller.snapshot().state).toBe("error");
    expect(controller.snapshot().muted).toBe(true);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function settled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
