/**
 * A step's design-frame fallback rect, in the 390×844 reference frame the
 * design handoff was measured against (docs/design_handoff_trisakay_tutorials).
 * Used only until the real target reports its own measured rect.
 */
export interface TutorialStepFrame {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
}

/** Which side of the spotlight the tooltip card is pinned to. */
export type TutorialTooltipSide = 'above' | 'below';

export interface TutorialStep {
  /** The app-defined screen key this step belongs to — the provider's navigation hook routes here before painting the coach mark. */
  screen: string;
  /** The id a screen registers via useTutorialTarget(id) for this step's spotlight. */
  targetId: string;
  tip: TutorialTooltipSide;
  frame: TutorialStepFrame;
  title: string;
  body: string;
}

/** A window-absolute rect, as reported by View.measureInWindow. */
export interface TutorialRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TutorialContextValue {
  /** True from start() until finish()/skip(); false the rest of the time. */
  active: boolean;
  /** 0 = welcome sheet, 1…total = coach marks, total + 1 = finished toast. */
  step: number;
  total: number;
  /** The step table entry for the current coach-mark step, or null on the welcome/finished steps. */
  currentStep: TutorialStep | null;
  start: () => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  goTo: (step: number) => void;
  finish: () => void;
  registerTarget: (id: string, rect: TutorialRect) => void;
  getTargetRect: (id: string) => TutorialRect | null;
}
