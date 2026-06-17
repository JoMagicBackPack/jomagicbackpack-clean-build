(() => {
  function initPromoVideoStart() {
    const video = document.getElementById('promoVideo');
    if (!video) return;

    let userSeeked = false;
    let firstPlayHandled = false;

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

    video.addEventListener('seeking', () => {
      if (firstPlayHandled && video.currentTime > 0.5) userSeeked = true;
    });

    video.addEventListener('loadedmetadata', () => {
      if (!firstPlayHandled && !userSeeked) snapToStart();
    });

    video.addEventListener('play', () => {
      unmute();
      if (firstPlayHandled || userSeeked) return;
      firstPlayHandled = true;
      snapToStart();
      window.setTimeout(() => {
        if (!userSeeked && video.currentTime > 0.35) snapToStart();
      }, 120);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPromoVideoStart, { once: true });
  } else {
    initPromoVideoStart();
  }
})();
