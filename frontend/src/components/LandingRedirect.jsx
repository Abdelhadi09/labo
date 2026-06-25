import { Navigate } from 'react-router-dom';

import {
  hasCompletedOnboarding,
} from '../utils/onboarding';

export default function LandingRedirect() {
  return hasCompletedOnboarding()
    ? (
      <Navigate
        to="/login"
        replace
      />
    )
    : (
      <Navigate
        to="/onboarding"
        replace
      />
    );
}