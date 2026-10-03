/**
 * Counts the loads of the Google Form iframe and tells what each one means.
 *
 * The embedded Google Form is a native HTML form: sending it navigates the iframe to the
 * confirmation page, and the "Enviar otra respuesta" link navigates it back to the empty form.
 * So the real (non-blank) loads alternate: 1st = form shown, 2nd = response sent, 3rd = form
 * shown again, 4th = response sent, and so on.
 */

export type FormPhase = 'view' | 'submit';

export interface FormTracker {
  /** Registers one real iframe load and returns what it means. */
  handleLoad(): FormPhase;
  /** Number of real loads registered so far. */
  readonly loads: number;
}

/**
 * @param onPhase called after every registered load with its meaning and the running load count.
 */
export function createFormTracker(onPhase?: (phase: FormPhase, loads: number) => void): FormTracker {
  let loads = 0;
  return {
    handleLoad(): FormPhase {
      loads += 1;
      const phase: FormPhase = loads % 2 === 1 ? 'view' : 'submit';
      onPhase?.(phase, loads);
      return phase;
    },
    get loads(): number {
      return loads;
    },
  };
}
