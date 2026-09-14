import { useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { CoachMark } from './CoachMark';
import { FinishedToast } from './FinishedToast';
import { scaleFrame } from './geometry';
import { useTutorial } from './TutorialProvider';
import { WelcomeSheet } from './WelcomeSheet';

export interface TutorialOverlayProps {
  firstName?: string | null;
  welcomeBody: string;
  finishedMessage: string;
  logoSource: ImageSourcePropType;
}

/**
 * Single mount point for the whole tour — apps render this once, near the
 * top of their root layout, alongside a `<TutorialProvider>`. Renders
 * nothing while inactive, the welcome sheet on step 0, one coach mark on
 * steps 1…total, and the finished toast on step total+1.
 */
export function TutorialOverlay({ firstName, welcomeBody, finishedMessage, logoSource }: TutorialOverlayProps) {
  const { active, step, total, currentStep, start, skip, next, back, getTargetRect } = useTutorial();
  const { width: screenWidth } = useWindowDimensions();

  if (!active) return null;

  if (step === 0) {
    return <WelcomeSheet firstName={firstName} body={welcomeBody} logoSource={logoSource} onSkip={skip} onTakeTour={next} />;
  }

  if (step === total + 1) {
    return <FinishedToast message={finishedMessage} onRestart={start} />;
  }

  if (!currentStep) return null;

  const measured = getTargetRect(currentStep.targetId);
  const rect = measured
    ? { ...measured, radius: scaleFrame(currentStep.frame, screenWidth).radius }
    : scaleFrame(currentStep.frame, screenWidth);

  return (
    <CoachMark step={step} total={total} tutorialStep={currentStep} rect={rect} onSkip={skip} onBack={back} onNext={next} />
  );
}
