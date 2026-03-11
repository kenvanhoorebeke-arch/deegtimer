import { describe, it, expect, vi } from "vitest";
import { advanceTimerBySeconds } from "./timerLogic.js";

// Hulpfunctie: maak een eenvoudige lopende timer
function makeTimer(overrides = {}) {
  return {
    id: "t1",
    name: "Test",
    emoji: "⏱",
    steps: [{ id: "s1", name: "Stap 1", duration: 300, repeat: 1 }],
    currentStep: 0,
    currentRepeat: 0,
    remaining: 300,
    started: true,
    paused: false,
    done: false,
    alerting: null,
    ...overrides,
  };
}

// ─── Scenario 1: Normaal aftellen ────────────────────────────────────────────

describe("Scenario 1 – Normaal aftellen (enkele stap)", () => {
  it("trekt de verstreken tijd af van remaining", () => {
    const t = makeTimer({ remaining: 120 });
    const result = advanceTimerBySeconds(t, 30);
    expect(result.remaining).toBe(90);
    expect(result.alerting).toBeNull();
    expect(result.currentStep).toBe(0);
  });

  it("blijft op 0 als elapsed > remaining en markeert als done", () => {
    const t = makeTimer({ remaining: 10 });
    const result = advanceTimerBySeconds(t, 60);
    expect(result.remaining).toBe(0);
    expect(result.alerting).toBe("done");
  });

  it("markeert als done als elapsed exact gelijk is aan remaining", () => {
    const t = makeTimer({ remaining: 45 });
    const result = advanceTimerBySeconds(t, 45);
    expect(result.remaining).toBe(0);
    expect(result.alerting).toBe("done");
  });

  it("roept onAlarm aan bij voltooiing", () => {
    const onAlarm = vi.fn();
    const t = makeTimer({ remaining: 10 });
    advanceTimerBySeconds(t, 10, onAlarm);
    expect(onAlarm).toHaveBeenCalledWith("t1");
  });

  it("roept onAlarm NIET aan bij gedeeltelijke voortgang", () => {
    const onAlarm = vi.fn();
    const t = makeTimer({ remaining: 300 });
    advanceTimerBySeconds(t, 30, onAlarm);
    expect(onAlarm).not.toHaveBeenCalled();
  });
});

// ─── Scenario 2: Telefoon vergrendeld (schermvergrendeling) ──────────────────

describe("Scenario 2 – Scherm vergrendeld, timer loopt door", () => {
  it("herstelt correct na 2 minuten vergrendeling", () => {
    const t = makeTimer({ remaining: 300 });
    const result = advanceTimerBySeconds(t, 120);
    expect(result.remaining).toBe(180);
    expect(result.alerting).toBeNull();
  });

  it("markeert als done als telefoon langer vergrendeld was dan remaining", () => {
    const t = makeTimer({ remaining: 60 });
    const result = advanceTimerBySeconds(t, 180); // 3 minuten vergrendeld
    expect(result.alerting).toBe("done");
    expect(result.remaining).toBe(0);
  });

  it("elapsed = 0 verandert niets", () => {
    const t = makeTimer({ remaining: 200 });
    const result = advanceTimerBySeconds(t, 0);
    expect(result.remaining).toBe(200);
    expect(result.alerting).toBeNull();
  });
});

// ─── Scenario 3: Meerdere stappen ────────────────────────────────────────────

describe("Scenario 3 – Multi-stap timer (bijv. bakplan)", () => {
  function makeMultiStep() {
    return makeTimer({
      steps: [
        { id: "s1", name: "Autolyse",  duration: 1800, repeat: 1 }, // 30 min
        { id: "s2", name: "Kneden",    duration:  420, repeat: 1 }, //  7 min
        { id: "s3", name: "Rijzen",    duration: 3600, repeat: 1 }, // 60 min
      ],
      currentStep: 0,
      remaining: 1800,
    });
  }

  it("gaat over naar de volgende stap als de eerste stap afloopt", () => {
    const t = makeMultiStep();
    const result = advanceTimerBySeconds(t, 1800);
    expect(result.alerting).toBe("next");
    expect(result.currentStep).toBe(1);
    expect(result.pendingStep).toBe(1);
    expect(result.remaining).toBe(420); // duur van stap 2
  });

  it("springt twee stappen over als elapsed groot genoeg is", () => {
    const t = makeMultiStep();
    // 1800 (stap 1) + 420 (stap 2) = 2220 seconden verstreken
    const result = advanceTimerBySeconds(t, 2220);
    expect(result.alerting).toBe("next");
    expect(result.currentStep).toBe(2);
    expect(result.remaining).toBe(3600);
  });

  it("markeert als done als alle stappen verstreken zijn", () => {
    const t = makeMultiStep();
    const totalDuration = 1800 + 420 + 3600; // 5820 sec
    const result = advanceTimerBySeconds(t, totalDuration);
    expect(result.alerting).toBe("done");
    expect(result.remaining).toBe(0);
  });

  it("past resterende tijd correct aan bij midden in een volgende stap", () => {
    const t = makeMultiStep();
    // 1800 sec (stap 1 klaar) + 100 sec diep in stap 2
    const result = advanceTimerBySeconds(t, 1900);
    expect(result.currentStep).toBe(1);
    expect(result.remaining).toBe(320); // 420 - 100
    expect(result.alerting).toBe("next");
  });
});

// ─── Scenario 4: Herhalingen (repeat > 1) ────────────────────────────────────

describe("Scenario 4 – Stap met herhalingen (bijv. 4× vouwen)", () => {
  function makeRepeatTimer() {
    return makeTimer({
      steps: [{ id: "s1", name: "Vouwen", duration: 1200, repeat: 4 }],
      currentStep: 0,
      currentRepeat: 0,
      remaining: 1200,
    });
  }

  it("gaat naar de volgende herhaling als de eerste voorbij is", () => {
    const t = makeRepeatTimer();
    const result = advanceTimerBySeconds(t, 1200);
    expect(result.alerting).toBe("repeat");
    expect(result.currentRepeat).toBe(1);
    expect(result.pendingRepeat).toBe(1);
    expect(result.remaining).toBe(1200);
  });

  it("slaat meerdere herhalingen over", () => {
    const t = makeRepeatTimer();
    const result = advanceTimerBySeconds(t, 2400); // 2 herhalingen
    expect(result.currentRepeat).toBe(2);
    expect(result.alerting).toBe("repeat");
  });

  it("markeert als done na alle 4 herhalingen", () => {
    const t = makeRepeatTimer();
    const result = advanceTimerBySeconds(t, 4800); // 4 × 1200
    expect(result.alerting).toBe("done");
    expect(result.remaining).toBe(0);
  });

  it("roept onAlarm aan bij elke overgang naar een nieuwe herhaling", () => {
    const onAlarm = vi.fn();
    const t = makeRepeatTimer();
    advanceTimerBySeconds(t, 1200, onAlarm);
    expect(onAlarm).toHaveBeenCalledTimes(1);
  });
});

// ─── Scenario 5: Randgevallen ─────────────────────────────────────────────────

describe("Scenario 5 – Randgevallen", () => {
  it("muteert het originele timer-object NIET", () => {
    const t = makeTimer({ remaining: 100 });
    const original = { ...t };
    advanceTimerBySeconds(t, 50);
    expect(t.remaining).toBe(original.remaining);
  });

  it("verwerkt een timer met één stap van 1 seconde correct", () => {
    const t = makeTimer({
      steps: [{ id: "s1", name: "Kort", duration: 1, repeat: 1 }],
      remaining: 1,
    });
    const result = advanceTimerBySeconds(t, 1);
    expect(result.alerting).toBe("done");
  });

  it("stap met repeat:1 behandelt voltooiing als done (niet als repeat)", () => {
    const t = makeTimer({ remaining: 300 });
    const result = advanceTimerBySeconds(t, 300);
    expect(result.alerting).toBe("done");
  });

  it("geeft dezelfde timer terug als elapsed 0 is en er niets verandert", () => {
    const t = makeTimer({ remaining: 100 });
    const result = advanceTimerBySeconds(t, 0);
    expect(result.remaining).toBe(100);
    expect(result.currentStep).toBe(0);
    expect(result.alerting).toBeNull();
  });
});
