/**
 * Schuift een timer `seconds` seconden vooruit.
 * Verwerkt meerdere stappen en herhalingen.
 * Roept `onAlarm(id)` aan als er een overgang of voltooiing plaatsvindt.
 * Geeft het bijgewerkte timer-object terug (puur, geen mutation).
 */
export function advanceTimerBySeconds(t, seconds, onAlarm = () => {}) {
  let rem    = t.remaining;
  let step   = t.currentStep;
  let repeat = t.currentRepeat;
  let left   = seconds;

  while (left > 0) {
    if (left < rem) {
      rem  -= left;
      left  = 0;
    } else {
      left -= rem;
      const stepData    = t.steps[step];
      const nextRepeat  = repeat + 1;

      if (nextRepeat < stepData.repeat) {
        repeat = nextRepeat;
        rem    = stepData.duration;
      } else {
        const nextStep = step + 1;
        if (nextStep < t.steps.length) {
          step   = nextStep;
          repeat = 0;
          rem    = t.steps[nextStep].duration;
        } else {
          onAlarm(t.id);
          return { ...t, remaining: 0, currentStep: step, currentRepeat: repeat, alerting: "done" };
        }
      }
    }
  }

  if (step !== t.currentStep) {
    onAlarm(t.id);
    return { ...t, remaining: rem, currentStep: step, currentRepeat: repeat, alerting: "next", pendingStep: step };
  }
  if (repeat !== t.currentRepeat) {
    onAlarm(t.id);
    return { ...t, remaining: rem, currentStep: step, currentRepeat: repeat, alerting: "repeat", pendingRepeat: repeat };
  }
  return { ...t, remaining: rem };
}
