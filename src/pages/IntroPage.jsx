import React, { useEffect, useState } from 'react';

export default function IntroPage({ onComplete }) {
  const [transitioning, setTransitioning] = useState(false);

  function handleEnter() {
    if (transitioning) return;
    setTransitioning(true);
  }

  useEffect(() => {
    if (!transitioning) return undefined;

    const timer = window.setTimeout(() => {
      onComplete();
    }, 900);

    return () => window.clearTimeout(timer);
  }, [transitioning, onComplete]);

  return (
    <div
      className={`intro-screen ${transitioning ? 'intro-screen--transitioning' : ''}`}
      onClick={handleEnter}
      role="button"
      tabIndex={0}
      aria-label="Enter MoneyTracker"
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') handleEnter();
      }}
    >
      <img
        src="/assets/moneytracker-opening.png"
        alt="MoneyTracker welcome"
        className="intro-art"
        draggable="false"
      />

      <div className="intro-hint">
        <span className="intro-hint__dot" />
        Click anywhere to continue
      </div>

      <div className={`intro-transition ${transitioning ? 'intro-transition--visible' : ''}`}>
        <img
          src="/assets/moneytracker-transition.png"
          alt=""
          className="intro-transition__art"
          draggable="false"
        />
      </div>
    </div>
  );
}
