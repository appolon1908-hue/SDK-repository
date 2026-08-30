import { describe, expect, it } from "vitest";
import { IntakePopupController, IntakeUiController, buildCallbackUiModel } from "../src/index.js";

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
