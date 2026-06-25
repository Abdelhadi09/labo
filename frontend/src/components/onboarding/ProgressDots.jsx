export default function ProgressDots({
  total,
  current,
}) {
  return (
    <div
      className="progress-dots"
      aria-label={`Étape ${current + 1} sur ${total}`}
    >
      {Array.from({ length: total }).map((_, index) => (
        <span
          key={index}
          className={`progress-dot ${
            current === index ? 'active' : ''
          }`}
        />
      ))}
    </div>
  );
}