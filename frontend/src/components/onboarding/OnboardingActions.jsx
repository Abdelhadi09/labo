export default function OnboardingActions({
  isLastSlide,
  onNext,
  onSkip,
}) {
  return (
    <div className="onboarding-actions">
      {!isLastSlide ? (
        <button
          type="button"
          className="onboarding-skip"
          onClick={onSkip}
          aria-label="Passer l'introduction"
        >
          Passer
        </button>
      ) : (
        <div />
      )}

      <button
        type="button"
        className="onboarding-next"
        onClick={onNext}
        aria-label={
          isLastSlide
            ? 'Commencer'
            : 'Diapositive suivante'
        }
      >
        {isLastSlide ? 'Commencer' : 'Suivant'}
      </button>
    </div>
  );
}