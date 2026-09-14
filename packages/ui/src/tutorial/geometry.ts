import type { TutorialRect, TutorialStepFrame } from './types';

/** The design frame the handoff was measured against (docs/design_handoff_trisakay_tutorials). */
export const DESIGN_FRAME_WIDTH = 390;

/**
 * Scales a step's design-frame fallback rect to the live device width. Pure
 * (no RN) so it can be unit-tested under this package's Node test runner.
 */
export function scaleFrame(frame: TutorialStepFrame, screenWidth: number): TutorialRect & { radius: number } {
  const s = screenWidth / DESIGN_FRAME_WIDTH;
  return {
    x: frame.left * s,
    y: frame.top * s,
    width: frame.width * s,
    height: frame.height * s,
    radius: frame.radius * s,
  };
}

/**
 * The tooltip arrow's horizontal offset from the tooltip's own left edge,
 * pointed at the spotlight rect's center and clamped to the handoff's
 * 20…300 design-frame range (scaled) so it never runs off the card.
 */
export function clampArrowLeft(rectCenterX: number, tooltipLeft: number, screenWidth: number): number {
  const s = screenWidth / DESIGN_FRAME_WIDTH;
  const relative = rectCenterX - tooltipLeft;
  return Math.min(Math.max(relative, 20 * s), 300 * s);
}
