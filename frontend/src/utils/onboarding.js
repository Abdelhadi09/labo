export const hasCompletedOnboarding = () => {
  return (
    localStorage.getItem(
      'onboarding_completed'
    ) === 'true'
  );
};

export const completeOnboarding = () => {
  localStorage.setItem(
    'onboarding_completed',
    'true'
  );
};

export const resetOnboarding = () => {
  localStorage.removeItem(
    'onboarding_completed'
  );
};