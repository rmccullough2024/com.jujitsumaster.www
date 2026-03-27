/* ===== CONFIG ===== */
const FRAME_COUNT = 121;
const FRAME_SPEED = 2.0;
const IMAGE_SCALE = 0.85;

/* ===== ELEMENTS ===== */
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const canvasWrap = document.getElementById("canvas-wrap");
const scrollContainer = document.getElementById("scroll-container");
const heroSection = document.getElementById("hero");
const loader = document.getElementById("loader");
const loaderFill = document.getElementById("loader-fill");
const loaderPercent = document.getElementById("loader-percent");
const darkOverlay = document.getElementById("dark-overlay");

/* ===== STATE ===== */
const frames = [];
let currentFrame = 0;
let bgColor = "#0a0a0a";
let allLoaded = false;

/* ===== CANVAS SIZING ===== */
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.scale(dpr, dpr);
  if (frames[currentFrame]) drawFrame(currentFrame);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/* ===== BACKGROUND COLOR SAMPLER ===== */
function sampleBgColor(img) {
  const tmpCanvas = document.createElement("canvas");
  tmpCanvas.width = img.naturalWidth;
  tmpCanvas.height = img.naturalHeight;
  const tmpCtx = tmpCanvas.getContext("2d");
  tmpCtx.drawImage(img, 0, 0);
  const corners = [
    tmpCtx.getImageData(2, 2, 1, 1).data,
    tmpCtx.getImageData(img.naturalWidth - 3, 2, 1, 1).data,
    tmpCtx.getImageData(2, img.naturalHeight - 3, 1, 1).data,
    tmpCtx.getImageData(img.naturalWidth - 3, img.naturalHeight - 3, 1, 1).data,
  ];
  const avg = [0, 1, 2].map(
    (ch) => Math.round(corners.reduce((s, c) => s + c[ch], 0) / 4)
  );
  return `rgb(${avg[0]},${avg[1]},${avg[2]})`;
}

/* ===== FRAME RENDERER ===== */
function drawFrame(index) {
  const img = frames[index];
  if (!img) return;

  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.min(cw / iw, ch / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (cw - dw) / 2;
  const dy = (ch - dh) / 2;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, dx, dy, dw, dh);
}

/* ===== FRAME PRELOADER ===== */
function loadFrames() {
  let loaded = 0;

  function loadFrame(i) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        frames[i] = img;
        loaded++;
        const pct = Math.round((loaded / FRAME_COUNT) * 100);
        loaderFill.style.width = pct + "%";
        loaderPercent.textContent = pct + "%";

        // Sample bg color periodically
        if (i % 20 === 0) {
          bgColor = sampleBgColor(img);
        }
        resolve();
      };
      img.onerror = () => {
        loaded++;
        resolve();
      };
      img.src = `frames/frame_${String(i + 1).padStart(4, "0")}.webp`;
    });
  }

  // Phase 1: Load first 10 frames
  const phase1 = [];
  for (let i = 0; i < Math.min(10, FRAME_COUNT); i++) {
    phase1.push(loadFrame(i));
  }

  Promise.all(phase1).then(() => {
    // Draw first frame immediately
    drawFrame(0);

    // Phase 2: Load remaining frames
    const phase2 = [];
    for (let i = 10; i < FRAME_COUNT; i++) {
      phase2.push(loadFrame(i));
    }

    Promise.all(phase2).then(() => {
      allLoaded = true;
      setTimeout(() => {
        loader.classList.add("hidden");
        initAll();
      }, 300);
    });
  });
}

/* ===== LENIS SMOOTH SCROLL ===== */
let lenis;
function initLenis() {
  lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ===== HERO CIRCLE-WIPE TRANSITION ===== */
function initHeroTransition() {
  ScrollTrigger.create({
    trigger: scrollContainer,
    start: "top top",
    end: "bottom bottom",
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      heroSection.style.opacity = Math.max(0, 1 - p * 15);
      const wipeProgress = Math.min(1, Math.max(0, (p - 0.01) / 0.06));
      const radius = wipeProgress * 75;
      canvasWrap.style.clipPath = `circle(${radius}% at 50% 50%)`;
    },
  });
}

/* ===== FRAME-TO-SCROLL BINDING ===== */
function initFrameScroll() {
  ScrollTrigger.create({
    trigger: scrollContainer,
    start: "top top",
    end: "bottom bottom",
    scrub: true,
    onUpdate: (self) => {
      const accelerated = Math.min(self.progress * FRAME_SPEED, 1);
      const index = Math.min(
        Math.floor(accelerated * FRAME_COUNT),
        FRAME_COUNT - 1
      );
      if (index !== currentFrame) {
        currentFrame = index;
        requestAnimationFrame(() => drawFrame(currentFrame));
      }

      // Re-sample bg color every ~20 frames
      if (frames[currentFrame] && currentFrame % 20 === 0) {
        bgColor = sampleBgColor(frames[currentFrame]);
      }
    },
  });
}

/* ===== SECTION ANIMATION SYSTEM ===== */
function positionSections() {
  document.querySelectorAll(".scroll-section").forEach((section) => {
    const enter = parseFloat(section.dataset.enter) / 100;
    const leave = parseFloat(section.dataset.leave) / 100;
    const midpoint = (enter + leave) / 2;
    const containerHeight = scrollContainer.offsetHeight;
    section.style.top = midpoint * containerHeight + "px";
    section.style.transform = "translateY(-50%)";
  });
}

function setupSectionAnimation(section) {
  const type = section.dataset.animation;
  const persist = section.dataset.persist === "true";
  const enter = parseFloat(section.dataset.enter) / 100;
  const leave = parseFloat(section.dataset.leave) / 100;
  const children = section.querySelectorAll(
    ".section-label, .section-heading, .section-body, .section-note, .cta-button, .stat"
  );

  const tl = gsap.timeline({ paused: true });

  switch (type) {
    case "fade-up":
      tl.from(children, { y: 50, opacity: 0, stagger: 0.12, duration: 0.9, ease: "power3.out" });
      break;
    case "slide-left":
      tl.from(children, { x: -80, opacity: 0, stagger: 0.14, duration: 0.9, ease: "power3.out" });
      break;
    case "slide-right":
      tl.from(children, { x: 80, opacity: 0, stagger: 0.14, duration: 0.9, ease: "power3.out" });
      break;
    case "scale-up":
      tl.from(children, { scale: 0.85, opacity: 0, stagger: 0.12, duration: 1.0, ease: "power2.out" });
      break;
    case "rotate-in":
      tl.from(children, { y: 40, rotation: 3, opacity: 0, stagger: 0.1, duration: 0.9, ease: "power3.out" });
      break;
    case "stagger-up":
      tl.from(children, { y: 60, opacity: 0, stagger: 0.15, duration: 0.8, ease: "power3.out" });
      break;
    case "clip-reveal":
      tl.from(children, { clipPath: "inset(100% 0 0 0)", opacity: 0, stagger: 0.15, duration: 1.2, ease: "power4.inOut" });
      break;
  }

  let isVisible = false;
  let hasPersisted = false;

  ScrollTrigger.create({
    trigger: scrollContainer,
    start: "top top",
    end: "bottom bottom",
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      const fadeIn = 0.03;
      const fadeOut = 0.03;

      if (p >= enter && p <= leave) {
        // Inside range
        const entryProgress = Math.min(1, (p - enter) / fadeIn);
        section.style.opacity = entryProgress;
        section.style.visibility = "visible";
        if (!isVisible) {
          isVisible = true;
          tl.play();
        }
      } else if (persist && p > leave) {
        // Past range but persist
        section.style.opacity = 1;
        section.style.visibility = "visible";
        hasPersisted = true;
      } else if (p < enter) {
        // Before range
        section.style.opacity = 0;
        section.style.visibility = "hidden";
        if (isVisible && !hasPersisted) {
          isVisible = false;
          tl.reverse();
        }
      } else {
        // After range, no persist
        const exitProgress = Math.max(0, 1 - (p - leave) / fadeOut);
        section.style.opacity = exitProgress;
        if (exitProgress <= 0) {
          section.style.visibility = "hidden";
          if (isVisible) {
            isVisible = false;
            tl.reverse();
          }
        }
      }
    },
  });
}

/* ===== COUNTER ANIMATIONS ===== */
function initCounters() {
  document.querySelectorAll(".stat-number").forEach((el) => {
    const target = parseFloat(el.dataset.value);
    const decimals = parseInt(el.dataset.decimals || "0");
    const obj = { val: 0 };

    ScrollTrigger.create({
      trigger: el.closest(".scroll-section"),
      start: "top 70%",
      onEnter: () => {
        gsap.to(obj, {
          val: target,
          duration: 2,
          ease: "power1.out",
          onUpdate: () => {
            el.textContent = decimals > 0
              ? obj.val.toFixed(decimals)
              : Math.round(obj.val);
          },
        });
      },
      onLeaveBack: () => {
        gsap.to(obj, {
          val: 0,
          duration: 0.5,
          onUpdate: () => {
            el.textContent = decimals > 0
              ? obj.val.toFixed(decimals)
              : Math.round(obj.val);
          },
        });
      },
    });
  });
}

/* ===== MARQUEE ===== */
function initMarquees() {
  document.querySelectorAll(".marquee-wrap").forEach((el) => {
    const speed = parseFloat(el.dataset.scrollSpeed) || -25;
    const enter = parseFloat(el.dataset.enter) / 100;
    const leave = parseFloat(el.dataset.leave) / 100;
    const fadeRange = 0.05;

    gsap.to(el.querySelector(".marquee-text"), {
      xPercent: speed,
      ease: "none",
      scrollTrigger: {
        trigger: scrollContainer,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
      },
    });

    // Fade marquee in/out
    ScrollTrigger.create({
      trigger: scrollContainer,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress;
        let opacity = 0;
        if (p >= enter - fadeRange && p < enter) {
          opacity = (p - (enter - fadeRange)) / fadeRange;
        } else if (p >= enter && p <= leave) {
          opacity = 1;
        } else if (p > leave && p <= leave + fadeRange) {
          opacity = 1 - (p - leave) / fadeRange;
        }
        el.style.opacity = opacity;
      },
    });
  });
}

/* ===== DARK OVERLAY ===== */
function initDarkOverlay() {
  // Stats section range
  const enter = 0.54;
  const leave = 0.70;
  const fadeRange = 0.04;

  ScrollTrigger.create({
    trigger: scrollContainer,
    start: "top top",
    end: "bottom bottom",
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      let opacity = 0;
      if (p >= enter - fadeRange && p <= enter) {
        opacity = 0.9 * ((p - (enter - fadeRange)) / fadeRange);
      } else if (p > enter && p < leave) {
        opacity = 0.9;
      } else if (p >= leave && p <= leave + fadeRange) {
        opacity = 0.9 * (1 - (p - leave) / fadeRange);
      }
      darkOverlay.style.opacity = opacity;
    },
  });
}

/* ===== INIT ===== */
function initAll() {
  initLenis();
  initHeroTransition();
  initFrameScroll();
  positionSections();
  document.querySelectorAll(".scroll-section").forEach(setupSectionAnimation);
  initCounters();
  initMarquees();
  initDarkOverlay();
}

/* ===== START ===== */
loadFrames();
