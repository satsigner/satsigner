(function initHeroLight() {
  var canvas = document.querySelector('.hero-canvas');
  var hero = document.querySelector('.hero');
  var mark = document.querySelector('.hero-mark');
  if (!canvas || !hero) return;

  var gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
  if (!gl) return;
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  var vs = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }';
  var fs = [
    'precision highp float;',
    'uniform vec2 uRes;',
    'uniform vec2 uCenter;',
    'uniform vec2 uAim;',
    'uniform float uTime;',
    'uniform float uShape;',
    'uniform vec2 uPointer;',
    'uniform float uPointerOn;',
    'uniform float uDpr;',
    'uniform float uReveal;',
    'uniform vec2 uHalf;',
    'uniform float uRadius;',
    'uniform float uTheme;',
    'uniform float uPulse;',
    'float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float sdCircle(vec2 p, float r){ return length(p) - r; }',
    'float sdRoundBox(vec2 p, vec2 b, float r){',
    '  vec2 q = abs(p) - b + r;',
    '  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;',
    '}',
    'void main(){',
    '  vec2 p = gl_FragCoord.xy;',
    '  p.y = uRes.y - p.y;',
    '  vec2 d = p - uCenter;',
    '  float sdf;',
    '  vec2 n;',
    '  float scale = min(uRes.x, uRes.y);',
    '  vec2 box = uHalf.x > 1.0 ? uHalf : vec2(scale * 0.105);',
    '  if (uShape < 0.5) {',
    '    float r = min(box.x, box.y);',
    '    sdf = sdCircle(d, r);',
    '    n = normalize(d + vec2(0.0001));',
    '  } else {',
    '    vec2 b = box;',
    '    float rad = min(uRadius, min(b.x, b.y));',
    '    sdf = sdRoundBox(d, b, rad);',
    '    vec2 q = abs(d) - b + rad;',
    '    vec2 g = max(q, 0.0);',
    '    float lg = length(g);',
    '    n = sign(d) * (lg > 0.001 ? g / lg : normalize(vec2(q.x, q.y) + vec2(0.0001)));',
    '  }',
    '  float ang = uTime * 0.21;',
    '  vec2 orbit = vec2(cos(ang), sin(ang));',
    '  vec2 aim = uPointer - uAim;',
    '  float aimLen = length(aim);',
    '  vec2 key = aimLen > 1.0 ? normalize(mix(orbit, aim / aimLen, uPointerOn)) : orbit;',
    '  float face = smoothstep(-0.08, 0.72, dot(n, key));',
    '  float far = exp(-max(sdf, 0.0) / ((36.0 + uPulse * 6.0) * uDpr));',
    '  float light = far * (0.02 + 0.38 * face) * (1.0 + uPulse * 0.22);',
    '  vec2 css = p / max(uDpr, 1.0);',
    '  float grain = hash21(floor(css * 2.0));',
    '  grain += hash21(floor(css * 4.24));',
    '  grain += hash21(floor(css * 6.3));',
    '  grain = clamp(grain * 0.33, 0.0, 1.0);',
    '  float floorDark = mix(0.055, 0.02, grain);',
    '  float floorLight = mix(0.925, 0.878, grain);',
    '  float page = 0.902;',
    '  float glow = light * mix(0.62, 1.2, grain);',
    '  float colDark = floorDark + glow;',
    '  float colLight = floorLight + glow * 0.95;',
    '  float floorB = mix(floorDark, floorLight, uTheme);',
    '  float col = mix(colDark, colLight, uTheme);',
    '  float rim = smoothstep(-0.2 * uDpr, 1.15 * uDpr, sdf);',
    '  col = mix(floorB, col, rim);',
    '  col = mix(floorB, col, uReveal);',
    '  float band = uRes.y * 0.22;',
    '  float fade = sqrt(clamp(min(p.y, uRes.y - p.y) / band, 0.0, 1.0));',
    '  col = mix(mix(page, col, fade), col * fade, 1.0 - uTheme);',
    '  gl_FragColor = vec4(vec3(col), 1.0);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  }
  var prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(prog, 'uRes');
  var uCenter = gl.getUniformLocation(prog, 'uCenter');
  var uAim = gl.getUniformLocation(prog, 'uAim');
  var uTime = gl.getUniformLocation(prog, 'uTime');
  var uShape = gl.getUniformLocation(prog, 'uShape');
  var uPointer = gl.getUniformLocation(prog, 'uPointer');
  var uPointerOn = gl.getUniformLocation(prog, 'uPointerOn');
  var uDpr = gl.getUniformLocation(prog, 'uDpr');
  var uReveal = gl.getUniformLocation(prog, 'uReveal');
  var uHalf = gl.getUniformLocation(prog, 'uHalf');
  var uRadius = gl.getUniformLocation(prog, 'uRadius');
  var uTheme = gl.getUniformLocation(prog, 'uTheme');
  var uPulse = gl.getUniformLocation(prog, 'uPulse');

  var logo = document.querySelector('.hero-logo-light');
  var lgl = logo && logo.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true });
  var lProg = null;
  var lu = null;
  if (lgl) {
    var lfs = [
      'precision highp float;',
      'uniform vec2 uRes;',
      'uniform vec2 uCenter;',
      'uniform float uTime;',
      'uniform vec2 uPointer;',
      'uniform float uPointerOn;',
      'uniform float uDpr;',
      'uniform float uRadius;',
      'float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
      'void main(){',
      '  vec2 p = gl_FragCoord.xy;',
      '  p.y = uRes.y - p.y;',
      '  vec2 d = p - uCenter;',
      '  float sdf = length(d) - uRadius + 3.0 * uDpr;',
      '  vec2 n = normalize(d + vec2(0.0001));',
      '  float ang = uTime * 0.21;',
      '  vec2 orbit = vec2(cos(ang), sin(ang));',
      '  vec2 aim = uPointer - uCenter;',
      '  float aimLen = length(aim);',
      '  vec2 key = aimLen > 1.0 ? normalize(mix(orbit, aim / aimLen, uPointerOn)) : orbit;',
      '  float face = smoothstep(-0.08, 0.72, dot(n, key));',
      '  float fall = max(uRadius / 120.0, 0.35);',
      '  float edge = exp(-max(sdf, 0.0) / (5.0 * fall));',
      '  float far = exp(-max(sdf, 0.0) / (36.0 * fall));',
      '  float light = edge * (0.08 + 1.05 * face) + far * (0.02 + 0.38 * face);',
      '  vec2 css = p / max(uDpr, 1.0);',
      '  float grain = hash21(floor(css * 2.0));',
      '  grain += hash21(floor(css * 4.24));',
      '  grain += hash21(floor(css * 6.3));',
      '  grain = clamp(grain * 0.33, 0.0, 1.0);',
      '  float bloom = light * mix(0.62, 1.2, grain);',
      '  float rim = smoothstep(-0.2 * uDpr, 1.15 * uDpr, sdf);',
      '  float alpha = clamp(bloom, 0.0, 1.0) * rim;',
      '  gl_FragColor = vec4(vec3(alpha), alpha);',
      '}'
    ].join('\n');
    function lcompile(type, src) {
      var sh = lgl.createShader(type);
      lgl.shaderSource(sh, src);
      lgl.compileShader(sh);
      return sh;
    }
    lProg = lgl.createProgram();
    lgl.attachShader(lProg, lcompile(lgl.VERTEX_SHADER, vs));
    lgl.attachShader(lProg, lcompile(lgl.FRAGMENT_SHADER, lfs));
    lgl.linkProgram(lProg);
    lgl.useProgram(lProg);
    var lbuf = lgl.createBuffer();
    lgl.bindBuffer(lgl.ARRAY_BUFFER, lbuf);
    lgl.bufferData(lgl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), lgl.STATIC_DRAW);
    var lloc = lgl.getAttribLocation(lProg, 'a');
    lgl.enableVertexAttribArray(lloc);
    lgl.vertexAttribPointer(lloc, 2, lgl.FLOAT, false, 0, 0);
    lgl.enable(lgl.BLEND);
    lgl.blendFunc(lgl.ONE, lgl.ONE_MINUS_SRC_ALPHA);
    lu = {
      res: lgl.getUniformLocation(lProg, 'uRes'),
      center: lgl.getUniformLocation(lProg, 'uCenter'),
      time: lgl.getUniformLocation(lProg, 'uTime'),
      pointer: lgl.getUniformLocation(lProg, 'uPointer'),
      pointerOn: lgl.getUniformLocation(lProg, 'uPointerOn'),
      dpr: lgl.getUniformLocation(lProg, 'uDpr'),
      radius: lgl.getUniformLocation(lProg, 'uRadius')
    };
  }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var shape = 3;
  var dpr = 1;
  var pointer = { x: 0, y: 0, tx: 0, ty: 0, on: 0, target: 0, moved: 0, idle: 0 };
  var introStart = 0;
  var introDone = reduce;
  var phoneReveal = reduce ? 1 : 0;
  var pulseAt = 0;
  if (mark && !reduce) {
    mark.addEventListener('click', function () {
      pulseAt = performance.now();
    }, true);
  }
  if (reduce) hero.classList.remove('is-intro');

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    var h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize);

  function setPointer(e) {
    var rect = canvas.getBoundingClientRect();
    var nx = (e.clientX - rect.left) * dpr;
    var ny = (e.clientY - rect.top) * dpr;
    if (Math.hypot(nx - pointer.tx, ny - pointer.ty) > 2 * dpr) pointer.moved = performance.now();
    pointer.tx = nx;
    pointer.ty = ny;
    pointer.target = 1;
  }
  hero.addEventListener('pointermove', setPointer);
  hero.addEventListener('pointerleave', function () { pointer.target = 0; });

  function frame(t) {
    resize();
    var rect = canvas.getBoundingClientRect();
    var cx = canvas.width * 0.5;
    var cy = canvas.height * 0.42;
    var halfX = 0;
    var halfY = 0;
    if (mark) {
      var m = mark.getBoundingClientRect();
      cx = (m.left + m.width / 2 - rect.left) * dpr;
      cy = (m.top + m.height / 2 - rect.top) * dpr;
      var cover = 2 * dpr;
      halfX = Math.max(1, (m.width / 2) * dpr - cover);
      halfY = Math.max(1, (m.height / 2) * dpr - cover);
    }
    pointer.x += (pointer.tx - pointer.x) * 0.23;
    pointer.y += (pointer.ty - pointer.y) * 0.23;
    var blend = pointer.target > pointer.on ? 0.045 : 0.018;
    pointer.on += (pointer.target - pointer.on) * blend;
    if (Math.abs(pointer.target - pointer.on) < 0.001) pointer.on = pointer.target;
    var idleTarget = pointer.target > 0 && t - pointer.moved > 900 ? 1 : 0;
    pointer.idle += (idleTarget - pointer.idle) * 0.016;
    if (Math.abs(idleTarget - pointer.idle) < 0.001) pointer.idle = idleTarget;
    var follow = pointer.on * (0.7 - pointer.idle * 0.52);
    var ax = cx;
    var ay = cy;
    if (shape >= 2 && mark) {
      var anchor = mark.querySelector('.hero-mark-type');
      if (anchor) {
        var ar = anchor.getBoundingClientRect();
        if (ar.width > 1 && ar.height > 1) {
          ax = (ar.left + ar.width / 2 - rect.left) * dpr;
          ay = (ar.top + ar.height / 2 - rect.top) * dpr;
        }
      }
    }
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform2f(uCenter, cx, cy);
    gl.uniform2f(uAim, ax, ay);
    gl.uniform1f(uTime, reduce ? 0 : t * 0.001);
    gl.uniform1f(uShape, shape >= 1 ? 1 : 0);
    gl.uniform2f(uPointer, pointer.x, pointer.y);
    gl.uniform1f(uPointerOn, follow);
    if (shape === 3 && !introDone && !introStart && document.documentElement.classList.contains('is-ready')) {
      introStart = t;
    }
    if (shape === 3 && introStart) {
      var elapsed = t - introStart;
      if (elapsed >= 3400) hero.classList.remove('is-intro');
      phoneReveal = elapsed < 1500 ? 0 : Math.min(1, (elapsed - 1500) / 1100);
      if (elapsed >= 2600) {
        introStart = 0;
        introDone = true;
      }
    }
    gl.uniform1f(uDpr, dpr);
    gl.uniform1f(uReveal, shape === 3 ? phoneReveal : 1);
    gl.uniform2f(uHalf, halfX, halfY);
    var cssRadius = 48;
    if (mark) cssRadius = Math.max(0, (parseFloat(getComputedStyle(mark).borderTopLeftRadius) || cssRadius) - 2);
    gl.uniform1f(uRadius, cssRadius * dpr);
    var theme = document.documentElement.getAttribute('data-theme') === 'light' ? 1 : 0;
    gl.uniform1f(uTheme, theme);
    var pulse = 0;
    if (pulseAt) {
      var pe = t - pulseAt;
      var attack = 55;
      var release = 220;
      if (pe >= attack + release) pulseAt = 0;
      else if (pe < attack) pulse = pe / attack;
      else pulse = 1 - (pe - attack) / release;
    }
    gl.uniform1f(uPulse, pulse);
    gl.clearColor(theme ? 0.902 : 0, theme ? 0.902 : 0, theme ? 0.902 : 0, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (lgl && lu && shape >= 2 && mark) {
      var type = mark.querySelector('.hero-mark-type');
      var lr = logo.getBoundingClientRect();
      var lw = Math.max(1, Math.floor(lr.width * dpr));
      var lh = Math.max(1, Math.floor(lr.height * dpr));
      if (logo.width !== lw || logo.height !== lh) {
        logo.width = lw;
        logo.height = lh;
      }
      var lcx = lw * 0.5;
      var lcy = lh * 0.286;
      var lrad = lw * 0.15;
      if (type && lr.width > 1) {
        var tr = type.getBoundingClientRect();
        lcx = (tr.left + tr.width / 2 - lr.left) * dpr;
        lcy = (tr.top + tr.height / 2 - lr.top) * dpr;
        lrad = (tr.width / 2) * dpr;
      }
      var lpx = pointer.x - (lr.left - rect.left) * dpr;
      var lpy = pointer.y - (lr.top - rect.top) * dpr;
      lgl.viewport(0, 0, lw, lh);
      lgl.clearColor(0, 0, 0, 0);
      lgl.clear(lgl.COLOR_BUFFER_BIT);
      lgl.useProgram(lProg);
      lgl.uniform2f(lu.res, lw, lh);
      lgl.uniform2f(lu.center, lcx, lcy);
      lgl.uniform1f(lu.time, reduce ? 0 : t * 0.001);
      lgl.uniform2f(lu.pointer, lpx, lpy);
      lgl.uniform1f(lu.pointerOn, follow);
      lgl.uniform1f(lu.dpr, dpr);
      lgl.uniform1f(lu.radius, lrad);
      lgl.drawArrays(lgl.TRIANGLES, 0, 3);
    }
    if (!reduce) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

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

(function initSiteNav() {
  var nav = document.querySelector('.site-nav');
  var menu = document.querySelector('.nav-menu');
  if (!nav || !menu) return;
  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    menu.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
  }
  menu.addEventListener('click', function () {
    setMenu(!nav.classList.contains('is-open'));
  });
  nav.querySelectorAll('.nav-links a').forEach(function (link) {
    link.addEventListener('click', function () { setMenu(false); });
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') setMenu(false);
  });
  window.addEventListener('resize', function () {
    if (window.innerWidth > 640) setMenu(false);
  });
})();

(function initHeroDemo() {
  var hero = document.querySelector('.hero');
  var mark = document.querySelector('.hero-mark');
  var splash = document.querySelector('.hero-splash');
  var app = document.querySelector('.hero-app');
  var phone = mark && mark.querySelector('.phone');
  if (!hero || !mark || !splash || !app || !phone) return;

  var clock = phone.querySelector('.phone-time');
  function paintClock() {
    if (!clock) return;
    var now = new Date();
    clock.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
  }

  function fitPhone() {
    var box = app.clientWidth ? app : mark;
    var scale = box.clientWidth / 390;
    phone.style.height = (box.clientHeight / scale) + 'px';
    phone.style.transform = 'scale(' + scale + ')';
  }

  fitPhone();
  paintClock();
  window.addEventListener('resize', fitPhone);

  document.querySelectorAll('.theme-toggle').forEach(function (button) {
    button.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      if (next === 'light') document.documentElement.setAttribute('data-theme', 'light');
      else document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  });

  splash.addEventListener('click', function () {
    if (hero.classList.contains('is-live')) return;
    fitPhone();
    hero.classList.add('is-live');
    splash.setAttribute('aria-hidden', 'true');
    app.removeAttribute('aria-hidden');
    if (window.satSignerDemo) window.satSignerDemo.open();
  });
})();

(function initFeatureFlows() {
  var cards = Array.prototype.slice.call(document.querySelectorAll('.feature-grid-card[data-screen]'));
  var dialog = document.getElementById('flow-modal');
  var modalFrame = dialog && dialog.querySelector('iframe');
  var modalTitle = document.getElementById('flow-modal-title');
  var modalDesc = document.getElementById('flow-modal-desc');
  if (!cards.length || !dialog || !modalFrame) return;

  var slugs = {};
  cards.forEach(function (card) {
    var heading = card.querySelector('h3');
    var base = (heading ? heading.textContent : card.getAttribute('data-screen') || 'flow')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    var slug = base;
    var n = 2;
    while (slugs[slug]) {
      slug = base + '-' + n;
      n += 1;
    }
    slugs[slug] = card;
    card.setAttribute('data-flow', slug);
  });

  var current = -1;
  var syncing = false;
  var slideToken = 0;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function flowSrc(screen, device) {
    var query = 'embed=1&screen=' + encodeURIComponent(screen);
    if (device) query += '&device=1';
    return 'test-site/?' + query;
  }

  function replay(frame) {
    if (!frame.contentWindow) return;
    frame.contentWindow.postMessage({ type: 'satsigner', play: true }, location.origin);
  }

  function flowSlug() {
    var hash = location.hash || '';
    var match = hash.match(/^#features\/([a-z0-9-]+)/);
    return match ? match[1] : '';
  }

  function paintFlow(card) {
    var heading = card.querySelector('h3');
    var copy = card.querySelector('p');
    var screen = card.getAttribute('data-screen');
    if (modalTitle) modalTitle.textContent = heading ? heading.textContent : '';
    if (modalDesc) modalDesc.textContent = copy ? copy.textContent : '';
    var nextSrc = flowSrc(screen, true);
    if (modalFrame.getAttribute('src') !== nextSrc) modalFrame.src = nextSrc;
    else replay(modalFrame);
  }

  function revealFlow(direction) {
    dialog.dataset.dir = direction < 0 ? 'prev' : 'next';
    dialog.classList.add('is-entering');
    void dialog.offsetWidth;
    dialog.classList.remove('is-entering');
  }

  function showFlow(index, direction) {
    var card = cards[index];
    if (!card || index === current) return;
    var token = ++slideToken;
    var leaving = dialog.open && current >= 0 && !reduceMotion;
    if (direction == null) direction = current < 0 || index > current ? 1 : -1;
    current = index;
    if (!leaving) {
      paintFlow(card);
      if (!dialog.open) dialog.showModal();
      dialog.focus();
      if (!reduceMotion) revealFlow(direction);
      return;
    }
    dialog.dataset.dir = direction < 0 ? 'prev' : 'next';
    dialog.classList.add('is-leaving');
    window.setTimeout(function () {
      if (token !== slideToken) return;
      paintFlow(card);
      dialog.classList.remove('is-leaving');
      revealFlow(direction);
    }, 280);
  }

  function openSlug(slug, push, direction) {
    if (!slugs[slug]) return;
    var hash = '#features/' + slug;
    if (location.hash === hash) {
      showFlow(cards.indexOf(slugs[slug]), direction);
      return;
    }
    syncing = true;
    if (push) history.pushState({ flow: slug }, '', hash);
    else history.replaceState({ flow: slug }, '', hash);
    syncing = false;
    showFlow(cards.indexOf(slugs[slug]), direction);
  }

  function closeFlow() {
    if ((location.hash || '').indexOf('#features/') === 0) {
      syncing = true;
      history.pushState({ flow: null }, '', '#features');
      syncing = false;
    }
    if (dialog.open) dialog.close();
  }

  function step(delta) {
    if (!cards.length) return;
    var index = current < 0 ? 0 : (current + delta + cards.length) % cards.length;
    openSlug(cards[index].getAttribute('data-flow'), true, delta);
  }

  cards.forEach(function (card) {
    var screen = card.getAttribute('data-screen');
    var layer = document.createElement('div');
    layer.className = 'feature-flow';
    var frame = document.createElement('iframe');
    frame.title = '';
    frame.tabIndex = -1;
    frame.setAttribute('aria-hidden', 'true');
    frame.loading = 'lazy';
    frame.src = flowSrc(screen, true);
    layer.appendChild(frame);
    card.insertBefore(layer, card.firstChild);
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.style.cursor = 'pointer';

    card.addEventListener('mouseenter', function () { replay(frame); });
    card.addEventListener('focusin', function () { replay(frame); });
    card.addEventListener('click', function (event) {
      if (event.target.closest('a')) return;
      openSlug(card.getAttribute('data-flow'), true);
    });
    card.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openSlug(card.getAttribute('data-flow'), true);
    });
  });

  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) closeFlow();
  });
  dialog.addEventListener('cancel', function (event) {
    event.preventDefault();
    closeFlow();
  });
  dialog.querySelector('[data-flow-close]').addEventListener('click', closeFlow);
  dialog.querySelectorAll('[data-flow-prev]').forEach(function (button) {
    button.addEventListener('click', function () { step(-1); });
  });
  dialog.querySelectorAll('[data-flow-next]').forEach(function (button) {
    button.addEventListener('click', function () { step(1); });
  });
  dialog.addEventListener('close', function () {
    modalFrame.src = 'about:blank';
    current = -1;
  });
  window.addEventListener('keydown', function (event) {
    if (!dialog.open) return;
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    step(event.key === 'ArrowRight' ? 1 : -1);
    dialog.focus();
  });

  window.addEventListener('hashchange', function () {
    if (syncing) return;
    var slug = flowSlug();
    if (slug && slugs[slug]) showFlow(cards.indexOf(slugs[slug]));
    else if (dialog.open) dialog.close();
  });
  window.addEventListener('popstate', function () {
    var slug = flowSlug();
    if (slug && slugs[slug]) showFlow(cards.indexOf(slugs[slug]));
    else if (dialog.open) dialog.close();
  });

  var initial = flowSlug();
  if (initial && slugs[initial]) showFlow(cards.indexOf(slugs[initial]));
})();

// Phone and its UI leave 1.3× faster than the copy, points, and logo.
(function () {
  var hero = document.getElementById('beta');
  var phone = hero && hero.querySelector('.hero-mark');
  var logo = phone && phone.querySelector('.hero-mark-type');
  var light = phone && phone.querySelector('.hero-logo-light');
  if (!hero || !phone || !logo) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var extra = 0.3;
  var frame = 0;

  function clear() {
    phone.style.transform = '';
    logo.style.transform = '';
    if (light) light.style.transform = '';
  }

  function apply() {
    frame = 0;
    var y = window.scrollY || window.pageYOffset || 0;
    if (y <= 0 || hero.classList.contains('is-intro')) {
      clear();
      return;
    }
    var shift = (y * extra).toFixed(2);
    phone.style.transform = 'translate3d(0,-' + shift + 'px,0)';
    logo.style.transform = 'translate3d(0,' + shift + 'px,0) translate(-50%, -50%)';
    if (light) light.style.transform = 'translate3d(0,' + shift + 'px,0)';
  }

  window.addEventListener('scroll', function () {
    if (frame) return;
    frame = requestAnimationFrame(apply);
  }, { passive: true });

  if (window.MutationObserver) {
    new MutationObserver(function () {
      if (frame) return;
      frame = requestAnimationFrame(apply);
    }).observe(hero, { attributes: true, attributeFilter: ['class'] });
  }
  apply();
})();
