(() => {
  function initPromoVideoStart() {
    const video = document.getElementById('promoVideo');
    if (!video) return;

    let userSeeked = false;
    let firstPlayHandled = false;
    let firstPlayStartedAt = 0;
    let correctiveResetUsed = false;

    const unmute = () => {
      video.defaultMuted = false;
      video.muted = false;
      video.volume = 1;
    };

    const snapToStart = () => {
      if (userSeeked) return;
      try {
        video.currentTime = 0;
      } catch (error) {
        console.warn('Could not reset promo video to the beginning.', error);
      }
    };

    const handlePrePlayStart = () => {
      if (!firstPlayHandled && !userSeeked) snapToStart();
    };

    video.addEventListener('pointerdown', handlePrePlayStart);
    video.addEventListener('loadedmetadata', handlePrePlayStart);
    video.addEventListener('loadeddata', handlePrePlayStart);

    video.addEventListener('seeking', () => {
      if (firstPlayHandled && video.currentTime > 0.5) userSeeked = true;
    });

    video.addEventListener('play', () => {
      unmute();
      if (firstPlayHandled || userSeeked) return;

      firstPlayHandled = true;
      firstPlayStartedAt = performance.now();
      snapToStart();

      [80, 220, 520].forEach((delay) => {
        window.setTimeout(() => {
          if (!userSeeked && video.currentTime > 0.35) snapToStart();
        }, delay);
      });
    });

    video.addEventListener('timeupdate', () => {
      if (!firstPlayHandled || correctiveResetUsed || userSeeked) return;
      if (performance.now() - firstPlayStartedAt > 1200) return;

      if (video.currentTime > 1.25) {
        correctiveResetUsed = true;
        snapToStart();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPromoVideoStart, { once: true });
  } else {
    initPromoVideoStart();
  }
})();
