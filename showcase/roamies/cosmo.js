// Cosmo: Celestial Nebula Slime Companion.
// Authentic fluid liquid droplet physics, celestial palette with orbiting Saturn planet,
// expressive anime eyes with sparkle highlights, pink blush cheeks, star particles,
// liquid squash & stretch puddle mode, and full Roamie gesture/act support.
// Renders directly into the dot matrix engine via k.setPx(gx, gy, color, alpha)
// so transparency, dirty rects, sig hashing, and speech bubble integration are 100% seamless.
(() => {
  const R = window.Roamie;
  if (!R) return;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // Rich original celestial color palette (RGB)
  const COLOR_CORE = [36, 18, 68];          // Deep nebula indigo core
  const COLOR_VIOLET = [124, 58, 237];      // Radiant royal violet
  const COLOR_MAGENTA = [192, 132, 252];    // Luminous orchid magenta
  const COLOR_CYAN = [56, 189, 248];        // Bioluminescent electric cyan rim
  const COLOR_CYAN_LIGHT = [186, 230, 253]; // Cyan aura highlight
  const COLOR_WHITE = [255, 255, 255];      // Sparkle white
  const COLOR_PUPIL = [16, 10, 32];         // Deep eye pupil
  const COLOR_BLUSH = [244, 114, 182];      // Soft pink blush
  const COLOR_GOLD = [251, 191, 36];        // Golden Saturn & stardust
  const COLOR_GOLD_LIGHT = [254, 240, 138]; // Ring bead highlight
  const COLOR_PAW = [96, 165, 250];         // Little floating blue paws

  function lerpColor(c1, c2, t) {
    const s = clamp(t, 0, 1);
    return [
      Math.round(c1[0] + (c2[0] - c1[0]) * s),
      Math.round(c1[1] + (c2[1] - c1[1]) * s),
      Math.round(c1[2] + (c2[2] - c1[2]) * s),
    ];
  }

  R.cosmo = {
    body(k, cx, cy, rad, st) {
      const { setPx, th } = k;
      const t = st.t;
      const A = st.act;
      const mode = st.mode;
      const sleepy = (st.sleepy ?? 0) > 0.5;
      const happy = (st.happy ?? 0) > 0.5 || A === 'hype';
      const upset = A === 'upset';
      const motivate = A === 'motivate';
      const wave = A === 'wave';
      const remind = A === 'remind';

      // -------------------------------------------------------------
      // 1. FLUID DROPLET MOTION & SQUASH/STRETCH
      // -------------------------------------------------------------
      const melt = sleepy ? 0.68 : 0;
      const jiggleAmp = (A === 'hype' ? 0.16 : upset ? 0.14 : motivate ? 0.11 : sleepy ? 0.03 : 0.07);
      const fluidBreath = Math.sin(t * (upset ? 14 : motivate ? 4.5 : 2.8)) * (upset ? 0.02 : 0.045);
      const fluidWobble = Math.cos(t * (upset ? 18 : 3.6)) * 0.03;

      // Squash and stretch factors (melt into flat wide puddle when sleepy/puddle mode)
      const sx = (1 + (st.sq ?? 0) * 0.14 + melt * 0.85 + fluidWobble) * (1 - fluidBreath);
      const sy = (1 - (st.sq ?? 0) * 0.12 - melt * 0.55 - fluidWobble) * (1 + fluidBreath);

      // Droplet center (moves down when melting into a puddle)
      const centerX = cx;
      const centerY = cy + (sleepy ? rad * 0.42 : 0);

      // Droplet radii in grid units
      const rx = rad * 1.08 * sx;
      const ry = rad * 0.98 * sy;

      // Scan area around droplet (plus margin for aura, orbiting ring, and stardust)
      const marginX = Math.ceil(rx * 1.8);
      const marginY = Math.ceil(ry * 1.8);
      const x0 = Math.floor(centerX - marginX);
      const x1 = Math.ceil(centerX + marginX);
      const y0 = Math.floor(centerY - marginY);
      const y1 = Math.ceil(centerY + marginY);

      // -------------------------------------------------------------
      // 2. ORBITING PLANET & RING CALCULATIONS
      // -------------------------------------------------------------
      const orbitSpeed = t * (mode === 'think' ? 3.0 : remind ? 2.5 : 1.35);
      const ringRadiusX = rx * 1.35;
      const ringRadiusY = ry * 0.38;
      const remindLevitate = remind ? -ry * 0.75 : 0;
      const ringCenterY = centerY + ry * 0.15 + remindLevitate;

      // Saturn position
      const saturnX = centerX + Math.cos(orbitSpeed) * (remind ? rad * 0.6 : ringRadiusX);
      const saturnY = ringCenterY + Math.sin(orbitSpeed) * (remind ? rad * 0.2 : ringRadiusY);
      const saturnBehind = Math.sin(orbitSpeed) < 0 && !remind;

      // Helper to test if cell is inside Saturn planet or its ring
      const getSaturnPixel = (gx, gy) => {
        const dx = gx - saturnX;
        const dy = gy - saturnY;
        const cosR = 0.95, sinR = 0.31; // ~18 degree tilt
        const rxRot = dx * cosR + dy * sinR;
        const ryRot = -dx * sinR + dy * cosR;
        const ringDist = (rxRot * rxRot) / (rad * rad * 0.18) + (ryRot * ryRot) / (rad * rad * 0.025);
        if (ringDist >= 0.7 && ringDist <= 1.3) {
          return COLOR_GOLD_LIGHT;
        }
        const pDist = Math.hypot(dx, dy);
        if (pDist <= rad * 0.18) {
          return pDist <= rad * 0.1 ? COLOR_GOLD_LIGHT : COLOR_GOLD;
        }
        return null;
      };

      // Helper to test if cell is part of the ring beads
      const getRingBeadPixel = (gx, gy) => {
        if (sleepy) return null; // In sleeping puddle, ring rests flat
        const dx = gx - centerX;
        const dy = gy - ringCenterY;
        const ellipseNorm = (dx * dx) / (ringRadiusX * ringRadiusX) + (dy * dy) / (ringRadiusY * ringRadiusY);
        if (Math.abs(ellipseNorm - 1.0) < 0.18) {
          const angle = Math.atan2(dy / ringRadiusY, dx / ringRadiusX);
          const bead = (Math.cos(angle * 12 + t * 2) > 0.4);
          if (bead) {
            const behind = dy < 0;
            return { color: COLOR_CYAN, behind };
          }
        }
        return null;
      };

      // -------------------------------------------------------------
      // 3. FACIAL FEATURES & EXPRESSIONS
      // -------------------------------------------------------------
      const lookX = st.look?.[0] ?? 0;
      const lookY = st.look?.[1] ?? 0;
      const eyeCenterY = centerY + (sleepy ? ry * 0.05 : -ry * 0.08) + lookY * ry * 0.12;
      const eyeSpacing = rx * 0.42;
      const eyeRadius = Math.max(1.8, rx * 0.22);

      const getFacePixel = (gx, gy) => {
        // Blush cheeks (shown when happy, hype, or sleepy)
        if (happy || sleepy) {
          for (const s of [-1, 1]) {
            const bx = centerX + s * (eyeSpacing * 1.1) + lookX * rx * 0.12;
            const by = eyeCenterY + eyeRadius * 0.9;
            if (Math.hypot(gx - bx, gy - by) <= eyeRadius * 0.55) {
              return COLOR_BLUSH;
            }
          }
        }

        // Check eyes
        for (const s of [-1, 1]) {
          const ex = centerX + s * eyeSpacing + lookX * rx * 0.12;
          const ey = eyeCenterY;
          const edx = gx - ex;
          const edy = gy - ey;
          const dist = Math.hypot(edx, edy);

          // A. SLEEPY: Curved sleeping eyelids (u u / ~ ~)
          if (sleepy) {
            const arcDist = Math.abs(edy - (edx * edx) / (eyeRadius * 1.2));
            if (Math.abs(edx) <= eyeRadius * 0.9 && arcDist <= 0.9) {
              return COLOR_WHITE;
            }
          }
          // B. HAPPY / HYPE: Joyful smiling squint (^)
          else if (happy) {
            const chevronDist = Math.abs(edy + Math.abs(edx) * 0.8 - eyeRadius * 0.3);
            if (Math.abs(edx) <= eyeRadius * 0.85 && chevronDist <= 0.85) {
              return COLOR_WHITE;
            }
          }
          // C. UPSET: Drooping sad eyes
          else if (upset) {
            const arcDist = Math.abs(edy + (edx * edx) / (eyeRadius * 1.2));
            if (Math.abs(edx) <= eyeRadius * 0.9 && arcDist <= 0.9) {
              return COLOR_MAGENTA;
            }
          }
          // D. NORMAL / IDLE / TALK / THINK: Big anime eyes with sparkle highlights
          else {
            if (dist <= eyeRadius) {
              // Sparkle glint at top-left
              if (edx < -0.2 && edy < -0.2 && Math.hypot(edx + eyeRadius * 0.35, edy + eyeRadius * 0.35) <= eyeRadius * 0.45) {
                return COLOR_WHITE;
              }
              // Small secondary glint at bottom-right
              if (edx > 0.3 && edy > 0.3 && Math.hypot(edx - eyeRadius * 0.35, edy - eyeRadius * 0.35) <= eyeRadius * 0.28) {
                return COLOR_CYAN_LIGHT;
              }
              // Inner pupil
              if (dist <= eyeRadius * 0.85) {
                return COLOR_PUPIL;
              }
              // Eye outer rim
              return COLOR_VIOLET;
            }
          }
        }

        // Talking animated mouth
        if (mode === 'talk' && !sleepy) {
          const mouthOpen = st.voice ? clamp(st.voice * 1.8, 0.4, 1.4) : (0.4 + 0.35 * Math.abs(Math.sin(t * 12)));
          const mx = centerX + lookX * rx * 0.12;
          const my = eyeCenterY + eyeRadius * 1.05;
          const mDist = Math.hypot((gx - mx) * 1.2, (gy - my) / mouthOpen);
          if (mDist <= eyeRadius * 0.45) {
            return COLOR_WHITE;
          }
        }

        return null;
      };

      // -------------------------------------------------------------
      // 4. FLOATING PAWS / HANDS
      // -------------------------------------------------------------
      const getPawPixel = (gx, gy) => {
        if (sleepy) return null;
        for (const s of [-1, 1]) {
          let pawX = centerX + s * (rx * 1.05);
          let pawY = centerY + ry * 0.3 + Math.sin(t * 3 + s) * (rad * 0.1);
          if (wave && s === 1) {
            pawX = centerX + rx * 0.95 + Math.sin(t * 10) * (rad * 0.25);
            pawY = centerY - ry * 0.4 + Math.cos(t * 10) * (rad * 0.15);
          }
          if (happy) {
            pawY = centerY - ry * 0.35 + Math.sin(t * 12 + s) * (rad * 0.15);
          }
          if (Math.hypot(gx - pawX, gy - pawY) <= rad * 0.18) {
            return COLOR_PAW;
          }
        }
        return null;
      };

      // -------------------------------------------------------------
      // 5. STAR SPARKLE PARTICLES (Hype / Motivate / Cheerful Frame 3)
      // Multi-colored stardust sparkles orbiting the celestial slime
      // -------------------------------------------------------------
      const getStarParticlePixel = (gx, gy) => {
        if (!happy && !motivate) return null;
        const particlePalette = [COLOR_GOLD_LIGHT, COLOR_CYAN_LIGHT, COLOR_BLUSH, COLOR_GOLD, COLOR_WHITE];
        for (let i = 0; i < 8; i++) {
          const ang = i * 0.785 + t * 2.2;
          const dist = rad * (1.28 + 0.38 * Math.sin(t * 3.5 + i * 1.5));
          const sx = Math.round(centerX + Math.cos(ang) * dist);
          const sy = Math.round(centerY + Math.sin(ang) * dist * 0.78);
          if (Math.hypot(gx - sx, gy - sy) <= 1.05) {
            return particlePalette[i % particlePalette.length];
          }
        }
        return null;
      };

      // -------------------------------------------------------------
      // 6. MAIN RASTER PASS ACROSS GRID BOUNDS
      // -------------------------------------------------------------
      for (let gy = y0; gy <= y1; gy++) {
        for (let gx = x0; gx <= x1; gx++) {
          // A. Draw behind ring/planet
          if (saturnBehind) {
            const sp = getSaturnPixel(gx, gy);
            if (sp) { setPx(gx, gy, sp); continue; }
          }
          const rb = getRingBeadPixel(gx, gy);
          if (rb && rb.behind) {
            setPx(gx, gy, rb.color);
            continue;
          }

          // B. Droplet Surface Tension Geometry
          const dx = gx - centerX;
          const dy = gy - centerY;
          const adjDx = dx / sx;
          const adjDy = dy / sy;
          const theta = Math.atan2(adjDy, adjDx);

          // Teardrop profile (slender peak at top, wide plump rounded belly at bottom)
          let baseProfile;
          if (adjDy < 0) {
            const topT = Math.abs(adjDy / (ry * 1.2 + 1e-4));
            baseProfile = 1.0 - clamp(topT, 0, 1) * 0.32;
          } else {
            baseProfile = 1.05;
          }

          // Multi-frequency surface tension ripples
          const w1 = Math.sin(theta * 3 + t * (upset ? 18 : 4.2)) * (rad * jiggleAmp);
          const w2 = Math.cos(theta * 5 - t * (upset ? 15 : 3.1)) * (rad * jiggleAmp * 0.5);
          const effectiveR = rad * baseProfile + w1 + w2;

          const dist = Math.hypot(adjDx, adjDy);
          const normDist = dist / (effectiveR + 1e-4);

          // C. Facial features (drawn on top of the droplet body)
          if (normDist <= 0.88) {
            const fp = getFacePixel(gx, gy);
            if (fp) {
              setPx(gx, gy, fp);
              continue;
            }
          }

          // D. Droplet Celestial Shading
          if (normDist <= 1.0) {
            let pxColor;
            if (normDist < 0.52) {
              pxColor = lerpColor(COLOR_CORE, COLOR_VIOLET, normDist / 0.52);
            } else if (normDist < 0.85) {
              pxColor = lerpColor(COLOR_VIOLET, COLOR_MAGENTA, (normDist - 0.52) / 0.33);
            } else {
              pxColor = lerpColor(COLOR_MAGENTA, COLOR_CYAN, (normDist - 0.85) / 0.15);
            }
            setPx(gx, gy, pxColor);
            continue;
          }

          // E. Bioluminescent Cyan Halo / Aura (smooth dither fade)
          if (normDist <= 1.25) {
            const auraFactor = (1.25 - normDist) / 0.25;
            if (auraFactor * 0.95 > th(gx, gy)) {
              setPx(gx, gy, COLOR_CYAN, Math.round(auraFactor * 255));
              continue;
            }
          }

          // F. Floating Paws
          const paw = getPawPixel(gx, gy);
          if (paw) {
            setPx(gx, gy, paw);
            continue;
          }

          // G. Star Sparkles
          const star = getStarParticlePixel(gx, gy);
          if (star) {
            setPx(gx, gy, star);
            continue;
          }

          // H. In-front Planetary Ring & Saturn
          if (!saturnBehind) {
            const sp = getSaturnPixel(gx, gy);
            if (sp) { setPx(gx, gy, sp); continue; }
          }
          if (rb && !rb.behind) {
            setPx(gx, gy, rb.color);
            continue;
          }
        }
      }
    },

    cursor(k, gx, gy, ax, ay, st) {
      const { setPx, th } = k;
      const t = st.t;
      // Mini Liquid Cosmic Pointer
      const rad = 7.0;
      const x0 = gx - 3, x1 = gx + 11;
      const y0 = gy - 3, y1 = gy + 11;

      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x - (gx + 4);
          const dy = y - (gy + 4);
          const dist = Math.hypot(dx, dy);
          if (dist <= rad) {
            let col = (dist > rad * 0.72) ? COLOR_CYAN : (dist > rad * 0.35) ? COLOR_VIOLET : COLOR_CORE;
            setPx(x, y, col);
          } else if (dist <= rad * 1.35) {
            const u = (rad * 1.35 - dist) / (rad * 0.35);
            if (u * 0.8 > th(x, y)) setPx(x, y, COLOR_CYAN);
          }
        }
      }

      // Mini golden satellite orbiting cursor pointer
      const satDist = 9.0;
      const satAng = t * 3.5;
      const satX = Math.round(gx + 4 + Math.cos(satAng) * satDist);
      const satY = Math.round(gy + 4 + Math.sin(satAng) * satDist * 0.5);
      setPx(satX, satY, COLOR_GOLD_LIGHT);
      setPx(satX + 1, satY, COLOR_GOLD);

      // Mini eye on cursor
      setPx(gx + 3, gy + 3, COLOR_WHITE);
      setPx(gx + 3, gy + 4, COLOR_PUPIL);
    },
  };
})();
