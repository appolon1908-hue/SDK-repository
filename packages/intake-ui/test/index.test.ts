// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { IntakePopupController, IntakeUiController, buildCallbackUiModel, mountIntakeUi, type IntakeUiModel } from "../src/index.js";

describe("intake UI controller", () => {
  it("tracks successful submissions", async () => {
    const controller = new IntakeUiController(
      buildCallbackUiModel(),
      (values) => ({ phone: values.phone }),
      async (payload) => ({ accepted: true, payload }),
    );
    const states: string[] = [];
    controller.subscribe((state) => states.push(state.status));
    const receipt = await controller.submit({ phone: "+15551234567" });
    expect(receipt.accepted).toBe(true);
    expect(states).toEqual(["idle", "submitting", "success"]);
  });

  it("reports submission errors", async () => {
    const controller = new IntakeUiController(
      buildCallbackUiModel(),
      (values) => values,
      async () => { throw new Error("blocked"); },
    );
    await expect(controller.submit({ phone: "x" })).rejects.toThrow("blocked");
    expect(controller.state.status).toBe("error");
  });
});

describe("popup controller", () => {
  it("respects dismissal windows", () => {
    let now = 1_000;
    const popup = new IntakePopupController({ id: "lead", trigger: "scroll", scrollPercent: 50, dismissForMs: 10_000 }, () => now);
    expect(popup.shouldOpen({ kind: "scroll", value: 60 })).toBe(true);
    popup.show();
    expect(popup.isOpen()).toBe(true);
    popup.dismiss();
    expect(popup.shouldOpen({ kind: "scroll", value: 80 })).toBe(false);
    now = 12_000;
    expect(popup.shouldOpen({ kind: "scroll", value: 80 })).toBe(true);
  });
});

describe("mounted intake UI", () => {
  it("blocks submission when required controls are invalid", async () => {
    const root = document.createElement("div");
    let calls = 0;
    mountIntakeUi(root, buildCallbackUiModel(), { onSubmit: async () => { calls += 1; } });

    root.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await settled();

    expect(calls).toBe(0);
  });

  it("normalizes numeric controls before submission", async () => {
    const root = document.createElement("div");
    const model: IntakeUiModel = {
      id: "nps",
      title: "NPS",
      mode: "survey",
      submitLabel: "Submit",
      sections: [{ id: "score", controls: [{ id: "score", name: "score", label: "Score", type: "nps", required: true, min: 0, max: 10 }] }],
    };
    let values: Record<string, unknown> = {};
    mountIntakeUi(root, model, { onSubmit: async (payload) => { values = payload; } });

    const input = root.querySelector<HTMLInputElement>('input[name="score"]');
    expect(input).not.toBeNull();
    input!.value = "9";
    root.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await settled();

    expect(values.score).toBe(9);
  });

  it("renders one selectable radio input per option", () => {
    const root = document.createElement("div");
    const model: IntakeUiModel = {
      id: "choice",
      title: "Choice",
      mode: "survey",
      submitLabel: "Submit",
      sections: [{
        id: "choice",
        controls: [{
          id: "channel",
          name: "channel",
          label: "Channel",
          type: "radio",
          required: true,
          options: [{ value: "sms", label: "SMS" }, { value: "email", label: "Email" }],
        }],
      }],
    };
    mountIntakeUi(root, model, { onSubmit: async () => undefined });

    const radios = [...root.querySelectorAll<HTMLInputElement>('input[type="radio"][name="channel"]')];
    expect(radios.map((radio) => radio.value)).toEqual(["sms", "email"]);
  });
});

function settled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
