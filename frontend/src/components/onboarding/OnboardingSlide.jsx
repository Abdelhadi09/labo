export default function OnboardingSlide({ slide }) {
  return (
    <section
      className="slide-content"
      aria-labelledby={`slide-title-${slide.id}`}
    >
      <h1
        id={`slide-title-${slide.id}`}
        className="slide-title"
      >
        {slide.title}
      </h1>

      <p className="slide-description">
        {slide.description}
      </p>
    </section>
  );
}