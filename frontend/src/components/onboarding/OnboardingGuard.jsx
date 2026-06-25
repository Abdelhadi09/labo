import { Navigate } from 'react-router-dom';

import {
  hasCompletedOnboarding,
} from '../utils/onboarding';

export default function OnboardingGuard({
  children,
}) {
  if (!hasCompletedOnboarding()) {
    return (
      <Navigate
        to="/onboarding"
        replace
      />
    );
  }

  return children;
}