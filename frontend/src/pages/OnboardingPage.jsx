import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';

import OnboardingSlide from '../components/onboarding/OnboardingSlide';
import ProgressDots from '../components/onboarding/ProgressDots';
import OnboardingActions from '../components/onboarding/OnboardingActions';

import uploadIllustration from '../assets/onboarding/upload.png';
import processIllustration from '../assets/onboarding/process.png';
import trackingIllustration from '../assets/onboarding/tracking.png';
import nurseIllustration from '../assets/onboarding/nurse.png';
import securityIllustration from '../assets/onboarding/security.png';

import '../styles/onboarding.css';

export default function OnboardingPage() {
  const navigate = useNavigate();

  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = useMemo(
    () => [
      {
        id: 1,
        image: uploadIllustration,
        title: 'Vos analyses médicales, simplifiées.',
        description:
          'Envoyez votre ordonnance, suivez votre demande et restez informé à chaque étape.',
      },

      {
        id: 2,
        image: processIllustration,
        title: '3 étapes seulement',
        description:
          'Envoyez votre ordonnance, notre laboratoire la traite puis recevez vos mises à jour.',
      },

      {
        id: 3,
        image: trackingIllustration,
        title: 'Suivez votre demande en temps réel',
        description:
          'Consultez l’état de vos analyses et recevez des notifications lorsque votre dossier évolue.',
      },

      {
        id: 4,
        image: nurseIllustration,
        title: 'Besoin d’une visite à domicile ?',
        description:
          'Faites une demande d’infirmier lorsque cela est disponible pour votre analyse.',
      },

      {
        id: 5,
        image: securityIllustration,
        title: 'Vos données sont protégées',
        description:
          'Vos informations médicales sont sécurisées et accessibles uniquement aux personnes autorisées.',
      },
    ],
    []
  );

  const isLastSlide = currentSlide === slides.length - 1;

  const completeOnboarding = () => {
    localStorage.setItem('onboarding_completed', 'true');
    navigate('/login');
  };

  const nextSlide = () => {
    if (isLastSlide) {
      completeOnboarding();
      return;
    }

    setCurrentSlide((prev) => prev + 1);
  };

  const previousSlide = () => {
    if (currentSlide === 0) return;

    setCurrentSlide((prev) => prev - 1);
  };

  const skip = () => {
    completeOnboarding();
  };

  const handlers = useSwipeable({
    onSwipedLeft: nextSlide,
    onSwipedRight: previousSlide,
    preventScrollOnSwipe: true,
    trackTouch: true,
  });

  useEffect(() => {
  const handleKeyDown = (event) => {
    if (event.key === 'ArrowRight') {
      nextSlide();
    }

    if (event.key === 'ArrowLeft') {
      previousSlide();
    }
  };

  window.addEventListener('keydown', handleKeyDown);

  return () => {
    window.removeEventListener(
      'keydown',
      handleKeyDown
    );
  };
}, [currentSlide]);

  return (
    <main className="onboarding-shell" {...handlers}>
      <div className="onboarding-card">
        <div className="onboarding-visual">
          <img
            src={slides[currentSlide].image}
            alt=""
            loading="lazy"
            draggable={false}
          />
        </div>

        <div className="onboarding-content">
          <OnboardingSlide slide={slides[currentSlide]} />

          <div className="onboarding-footer">
            <ProgressDots
              total={slides.length}
              current={currentSlide}
            />

            <OnboardingActions
              isLastSlide={isLastSlide}
              onNext={nextSlide}
              onSkip={skip}
            />
          </div>
        </div>
      </div>
    </main>
  );
}