if (typeof Swiper !== 'undefined') {
  try {
    new Swiper('.events', {
      effect: 'coverflow',
      centeredSlides: true,
      slidesPerView: 1,
      loop: true,
      pagination: true,
      coverflowEffect: {
        rotate: 50,
        stretch: 50,
        depth: 300,
        modifier: 1,
        slideShadows: true,
      },
      breakpoints: {
        10: {
          slidesPerView: 2,
        },
      },
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
    });
  } catch (e) {
    /* Swiper optional — do not block GSAP / perspective below */
  }
}

// Feature pairs: init each perspective block + scroll-in text animation
(function initFeaturePairs() {
  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  const featurePairs = document.querySelectorAll('.feature-pair');
  featurePairs.forEach(function(pair) {
    const content = pair.querySelector('.feature-pair-content');
    const perspectiveEl = pair.querySelector('.perspective-section');
    if (!content || !perspectiveEl) return;

    // --- Text animation: animate content when pair enters viewport (skip if column empty)
    const contentKids = content.querySelectorAll('.feature-pair-headline, .feature-pair-intro, .section-title, .section-intro, .features-list li, .feature-card');
    if (contentKids.length) {
      gsap.set(contentKids, { opacity: 0, y: 28 });
      gsap.to(contentKids, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        stagger: 0.06,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: pair,
          start: 'top 75%',
          toggleActions: 'play none none none',
          invalidateOnRefresh: true,
        },
      });
    }

    // --- Perspective block: tilt on pointer + scroll-in for layers
    const mq = window.matchMedia('(max-width: 1200px)');
    const isMobile = mq.matches;
    if (!isMobile) {
      gsap.set(perspectiveEl, { perspective: 650 });
    } else {
      gsap.set(perspectiveEl, { clearProps: 'perspective' });
    }

    const inner = perspectiveEl.querySelector('.perspective-inner');
    const bgWrap = perspectiveEl.querySelector('.perspective-bg-wrap');
    const bg = perspectiveEl.querySelector('.perspective-bg');
    const layers = perspectiveEl.querySelectorAll('.perspective-layer');
    if (!inner || !layers.length) return;

    const typeEl = perspectiveEl.querySelector('.perspective-type');
    const titleLayer = perspectiveEl.querySelector('.perspective-type-title-layer');
    gsap.set(inner, { y: 36 });
    gsap.set(layers, { opacity: 0 });
    if (typeEl) gsap.set(typeEl, { opacity: 0 });
    if (titleLayer) gsap.set(titleLayer, { opacity: 0 });
    const typeDetails = perspectiveEl.querySelectorAll('.perspective-type-detail');
    if (typeDetails.length) gsap.set(typeDetails, { opacity: 0 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: perspectiveEl,
        start: 'top 55%',
        toggleActions: 'play none none none',
        invalidateOnRefresh: true,
      },
    });
    tl.to(inner, { y: 0, duration: 1.8, ease: 'power2.out' }, 0);
    tl.to(layers, { opacity: 1, duration: 1.4, stagger: 0.1, ease: 'power1.out' }, 0.2);
    if (titleLayer) tl.to(titleLayer, { opacity: 1, duration: 0.9, ease: 'power1.out' }, 0.3);
    if (typeEl) tl.to(typeEl, { opacity: 1, duration: 0.9, ease: 'power1.out' }, 0.35);
    if (typeDetails.length) tl.to(typeDetails, { opacity: 1, duration: 0.7, ease: 'power1.out' }, 0.5);

    const outer = perspectiveEl.querySelector('.perspective-outer');
    if (!outer) return;

    const desktopDepths = [-20, 0, 25, 50, 120, 160];
    const layerDepths = isMobile ? [0, 0, 0, 0, 0, 0] : desktopDepths;
    layers.forEach(function(el, i) {
      if (isMobile) {
        // Clear all GSAP inline transforms so CSS takes over:
        // layers 0–4 get transform: translateX(-50%) from CSS (stacked),
        // layer-5 gets transform: none from CSS (in-flow reference)
        gsap.set(el, { clearProps: 'xPercent,yPercent,z,transform' });
      } else {
        gsap.set(el, { xPercent: -50, yPercent: -50, z: layerDepths[i] });
      }
    });

    if (!isMobile) {
      const outerRX = gsap.quickTo(outer, 'rotationX', { ease: 'power3' });
      const outerRY = gsap.quickTo(outer, 'rotationY', { ease: 'power3' });
      const innerX = gsap.quickTo(inner, 'x', { ease: 'power3' });
      const innerY = gsap.quickTo(inner, 'y', { ease: 'power3' });
      const flatZ = 0;
      const layerZQuicks = [];
      layers.forEach(function(el, i) {
        layerZQuicks.push(gsap.quickTo(el, 'z', { ease: 'power2.out' }));
      });
      const tiltOuter = 15;
      const tiltInner = 30;
      perspectiveEl.addEventListener('pointermove', function(e) {
        outerRX(gsap.utils.interpolate(tiltOuter, -tiltOuter, e.y / window.innerHeight));
        outerRY(gsap.utils.interpolate(-tiltOuter, tiltOuter, e.x / window.innerWidth));
        innerX(gsap.utils.interpolate(-tiltInner, tiltInner, e.x / window.innerWidth));
        innerY(gsap.utils.interpolate(-tiltInner, tiltInner, e.y / window.innerHeight));
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const dx = (e.clientX - cx) / (cx || 1);
        const dy = (e.clientY - cy) / (cy || 1);
        const distance = Math.min(1, Math.sqrt(dx * dx + dy * dy));
        layerZQuicks.forEach(function(setZ, i) {
          const z = flatZ + (layerDepths[i] - flatZ) * distance;
          setZ(z);
        });
      });
      perspectiveEl.addEventListener('pointerleave', function() {
        outerRX(0);
        outerRY(0);
        innerX(0);
        innerY(0);
        layerDepths.forEach(function(z, i) {
          layerZQuicks[i](z);
        });
      });
    }

    // Re-apply correct 3D/flat states when crossing the 1200px breakpoint
    mq.addEventListener('change', function(e) {
      if (e.matches) {
        // Switched to mobile: clear all inline 3D transforms, restore flow layout
        gsap.set(perspectiveEl, { clearProps: 'perspective' });
        gsap.set(outer, { clearProps: 'rotationX,rotationY' });
        gsap.set(inner, { clearProps: 'x,y' });
        layers.forEach(function(el) { gsap.set(el, { clearProps: 'xPercent,yPercent,z,transform' }); });
        if (bgWrap) gsap.set(bgWrap, { clearProps: 'z' });
      } else {
        // Switched to desktop: restore 3D absolute positioning
        gsap.set(perspectiveEl, { perspective: 650 });
        layers.forEach(function(el, i) { gsap.set(el, { xPercent: -50, yPercent: -50, z: desktopDepths[i] }); });
        if (bgWrap) gsap.set(bgWrap, { z: -420 });
      }
      ScrollTrigger.refresh();
    });

    if (bgWrap) {
      if (!isMobile) {
        gsap.set(bgWrap, { z: -420, y: 0 });
      } else {
        gsap.set(bgWrap, { clearProps: 'z', y: 0 });
      }
      var bgTweenVars = {
        y: -220,
        ease: 'none',
        scrollTrigger: {
          trigger: perspectiveEl,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.2,
          invalidateOnRefresh: true,
        },
      };
      if (!isMobile) bgTweenVars.z = -420;
      gsap.to(bgWrap, bgTweenVars);
    }
  });

  function refreshFeatureScrollTriggers() {
    if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
  }

  refreshFeatureScrollTriggers();
  requestAnimationFrame(function() {
    requestAnimationFrame(refreshFeatureScrollTriggers);
  });

  var resizeScrollT;
  window.addEventListener('resize', function() {
    clearTimeout(resizeScrollT);
    resizeScrollT = setTimeout(refreshFeatureScrollTriggers, 120);
  });

  function revealPerspectiveIfInViewButHidden() {
    if (typeof gsap === 'undefined') return;
    var vh = window.innerHeight || document.documentElement.clientHeight || 600;
    document.querySelectorAll('.perspective-section').forEach(function(section) {
      var firstLayer = section.querySelector('.perspective-layer');
      if (!firstLayer) return;
      var op = parseFloat(window.getComputedStyle(firstLayer).opacity);
      if (op >= 0.05) return;
      var rect = section.getBoundingClientRect();
      var inView = rect.top < vh * 0.92 && rect.bottom > vh * 0.08;
      if (!inView) return;
      var inner = section.querySelector('.perspective-inner');
      var layers = section.querySelectorAll('.perspective-layer');
      var typeEl = section.querySelector('.perspective-type');
      var titleLayer = section.querySelector('.perspective-type-title-layer');
      var details = section.querySelectorAll('.perspective-type-detail');
      if (inner) gsap.set(inner, { y: 0 });
      if (layers.length) gsap.set(layers, { opacity: 1 });
      if (typeEl) gsap.set(typeEl, { opacity: 1 });
      if (titleLayer) gsap.set(titleLayer, { opacity: 1 });
      if (details.length) gsap.set(details, { opacity: 1 });
    });
  }

  window.addEventListener('load', function() {
    refreshFeatureScrollTriggers();
    requestAnimationFrame(function() {
      setTimeout(revealPerspectiveIfInViewButHidden, 80);
      setTimeout(revealPerspectiveIfInViewButHidden, 500);
    });
  });
})();
