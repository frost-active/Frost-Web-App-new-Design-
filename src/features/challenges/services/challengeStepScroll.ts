export function scrollToChangedChallengeStep(
  previousStep: number,
  currentStep: number,
  target: HTMLElement | null,
  prefersReducedMotion: boolean,
): void {
  if (previousStep === currentStep || !target) return;

  target.scrollIntoView({
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
    block: 'nearest',
    inline: 'nearest',
  });
}
