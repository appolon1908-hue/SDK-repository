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
});
