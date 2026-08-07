(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const playerHealthEl = document.getElementById("playerHealth");
  const computerHealthEl = document.getElementById("computerHealth");
  const powerBarOuter = document.getElementById("powerBarOuter");
  const powerBarInner = document.getElementById("powerBarInner");
  const menuScreen = document.getElementById("menuScreen");
  const gameOverScreen = document.getElementById("gameOverScreen");
  const resultTitle = document.getElementById("resultTitle");
  const playBtn = document.getElementById("playBtn");
  const againBtn = document.getElementById("againBtn");
  const monikaSpeech = document.getElementById("monikaSpeech");
  const playerWinsEl = document.getElementById("playerWins");
  const computerWinsEl = document.getElementById("computerWins");

  let playerWins = 0;
  let computerWins = 0;

  // ---- Audio (synthesized, no asset files needed) ----
  let audioCtx = null;
  function ensureAudioContext() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function playThump() {
    const ac = ensureAudioContext();
    if (!ac) return;
    const t0 = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.12);
    gain.gain.setValueAtTime(0.6, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + 0.16);
  }

  function playCoin() {
    const ac = ensureAudioContext();
    if (!ac) return;
    const t0 = ac.currentTime;
    [988, 1319, 1568].forEach((freq, i) => {
      const start = t0 + i * 0.045;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.22, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
      osc.connect(gain).connect(ac.destination);
      osc.start(start);
      osc.stop(start + 0.13);
    });
  }

  function playMoan() {
    const ac = ensureAudioContext();
    if (!ac) return;
    const t0 = ac.currentTime;
    const osc = ac.createOscillator();
    const vibrato = ac.createOscillator();
    const vibratoGain = ac.createGain();
    const gain = ac.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, t0);
    osc.frequency.exponentialRampToValueAtTime(110, t0 + 0.9);
    vibrato.frequency.value = 6;
    vibratoGain.gain.value = 8;
    vibrato.connect(vibratoGain).connect(osc.frequency);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);
    osc.connect(gain).connect(ac.destination);
    vibrato.start(t0);
    osc.start(t0);
    vibrato.stop(t0 + 0.95);
    osc.stop(t0 + 0.95);
  }

  const MIN_SPEED = 780;
  const MAX_SPEED = 1450;
  const CHARGE_TIME = 1.1; // seconds to reach full power

  const MIN_COMMENTARY_GAP = 1; // commentary fires every 1-2 resolved player shots, picked fresh each time
  const MAX_COMMENTARY_GAP = 2;
  function randomCommentaryGap() {
    return MIN_COMMENTARY_GAP + Math.floor(Math.random() * (MAX_COMMENTARY_GAP - MIN_COMMENTARY_GAP + 1));
  }

  const MONIKA_LINES = {
    bodyHit: [
      "Hey! That hurt my favorite outfit.",
      "Ow! Right in the shopping bags!",
      "You're gonna pay for my next outfit.",
      "Bullseye? More like rude-seye.",
      "That's gonna cost you a snack AND an apology.",
    ],
    legHit: [
      "Guess I'm hopping to the checkout now.",
      "My legs! Now I have to hop everywhere!",
      "Ankle attack! Not cool, not cool at all.",
      "Hey, these are brand new shoes!",
      "Nice aim. Terrible manners.",
    ],
    tooWeak: [
      "Told you to eat your veggies!",
      "That coin gave up before I did.",
      "Was that a throw or a sneeze?",
      "My grandma throws harder than that.",
      "Even my shopping bags hit harder!",
    ],
    tooFlat: [
      "You clipped my shadow. Progress, I guess.",
      "So flat! Even pancakes have more arc.",
      "Almost! Try throwing UP a little too.",
      "You hit the floor. The floor says hi.",
      "So close! Add a little more height.",
    ],
    tooHigh: [
      "Are you throwing at me or at the ceiling?",
      "That one's still flying. Might hit a plane.",
      "Cute, you're feeding the birds now.",
      "That coin is basically in space now.",
      "Aim lower, this isn't rocket science!",
    ],
    miss: [
      "Missed me completely. I'm shopping in peace over here.",
      "Was that supposed to scare me?",
      "Nice try! Didn't even come close.",
      "I didn't even blink.",
      "Air! You hit the air! Great job.",
    ],
    random: [
      "Woda, czapka, krem!",
      "You haven't drunk anything for weeks!",
      "Don't forget to breathe!",
      "I'll join you on the sofa in 5mins.. 15mins... 1hour... tomorrow?",
    ],
  };

  const RANDOM_LINE_CHANCE = 0.25; // chance to interrupt with an off-topic line instead

  // Candidate platform spots: xFrac is position across the canvas, h is height
  // above the base ground line. Each side picks one at random per match.
  const LEFT_SPOTS = [
    { xFrac: 0.14, h: 0 },
    { xFrac: 0.22, h: 85 },
    { xFrac: 0.10, h: 160 },
    { xFrac: 0.27, h: 35 },
  ];
  const RIGHT_SPOTS = [
    { xFrac: 0.86, h: 0 },
    { xFrac: 0.78, h: 85 },
    { xFrac: 0.90, h: 160 },
    { xFrac: 0.73, h: 35 },
  ];
  const PLATFORM_WIDTH = 60;

  const player = new Stickman(W * 0.18, WORLD_FLOOR_Y, 1, "#2a2a2a");
  const computer = new Stickman(W * 0.86, WORLD_FLOOR_Y, -1, "#5a2a2a");

  const computerHeadImg = new Image();
  computerHeadImg.src = "assets/computer-head.webp";
  computer.headImage = computerHeadImg;
  computer.headCrop = { sx: 0, sy: 100, sw: 530, sh: 600 }; // whole head (hair to chin, ear to nose), trimmed short of the shoulders/tank top
  computer.headScale = 2;
  computer.headOffsetY = -4;
  computer.showHeadOutline = false;
  computer.wearsDress = true;

  const backgroundImg = new Image();
  backgroundImg.src = "assets/background.jpg";

  let spears = [];
  let state = "menu"; // menu | playing | gameover
  let coinThrowCount = 0; // every 10th thrown coin bursts into shrapnel
  let shotsSinceComment = 0;
  let nextCommentaryGap = randomCommentaryGap();
  let speechHideTimer = null;
  const lastLineByCategory = {};
  let carAnim = null; // { startTime, duration, x0, y } drives Monika away when she loses
  let mouse = { x: player.throwPoint.x + 100, y: player.throwPoint.y - 40 };

  let playerCharging = false;
  let playerChargeStart = 0;
  let playerSpearInFlight = false;

  let computerSpearInFlight = false;
  let computerTimer = 1.2;
  let computerCharging = false;
  let computerChargeElapsed = 0;
  let computerChargeDuration = 0.6;
  let computerTargetAngle = 0;
  let computerTargetSpeed = 0;

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function updateHud() {
    playerHealthEl.style.width = (player.hp / player.maxHp) * 100 + "%";
    computerHealthEl.style.width = (computer.hp / computer.maxHp) * 100 + "%";
  }

  function canvasPointFromEvent(evt) {
    const rect = canvas.getBoundingClientRect();
    const cx = evt.clientX !== undefined ? evt.clientX : (evt.touches && evt.touches[0].clientX);
    const cy = evt.clientY !== undefined ? evt.clientY : (evt.touches && evt.touches[0].clientY);
    return {
      x: ((cx - rect.left) / rect.width) * W,
      y: ((cy - rect.top) / rect.height) * H,
    };
  }

  function updatePlayerAim() {
    const tp = player.throwPoint;
    let dx = mouse.x - tp.x;
    let dy = mouse.y - tp.y;
    if (dx < 10) dx = 10; // keep aiming forward
    let angle = Math.atan2(-dy, dx); // upward positive
    angle = clamp(angle, -70 * (Math.PI / 180), 75 * (Math.PI / 180));
    player.aimAngle = angle;
  }

  function throwSpear(thrower, angle, speed) {
    const tp = thrower.throwPoint;
    const vx = Math.cos(angle) * speed * thrower.facing;
    const vy = -Math.sin(angle) * speed;
    const owner = thrower === player ? "player" : "computer";
    const s = new Spear(tp.x, tp.y, vx, vy, owner);
    coinThrowCount++;
    if (coinThrowCount % 10 === 0) {
      s.explosive = true;
    }
    spears.push(s);
  }

  function spawnShrapnel(x, y) {
    const count = 5;
    const speed = 620;
    const baseAngle = Math.random() * Math.PI * 2;
    const fragments = [];
    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i / count) * Math.PI * 2;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const frag = new Spear(x, y, vx, vy, "neutral");
      frag.radius = 6;
      fragments.push(frag);
    }
    return fragments;
  }

  function hitTargetsFor(owner) {
    if (owner === "player") return [computer];
    if (owner === "computer") return [player];
    return [player, computer];
  }

  // Samples along this frame's travel path (rather than just the endpoint) so a
  // fast-moving coin can't skip clean over a narrow hit zone between two frames.
  function findHitAlongPath(owner, x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / 4));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      for (const target of hitTargetsFor(owner)) {
        if (target.state === "dead") continue;
        const result = target.checkHit(x, y);
        if (result) return { result, target };
      }
    }
    return null;
  }

  function solveAngleForTarget(dx, dy, speed) {
    // dx: horizontal distance (positive), dy: vertical distance target is ABOVE launch point (positive = up)
    const g = GRAVITY;
    const v2 = speed * speed;
    const under = v2 * v2 - g * (g * dx * dx + 2 * dy * v2);
    if (under < 0) return null;
    const root = Math.sqrt(under);
    const angleLow = Math.atan((v2 - root) / (g * dx));
    return angleLow;
  }

  function startComputerAim() {
    // pick a target zone on the player, weighted so headshots are less common
    const roll = Math.random();
    const zones = player.zones;
    let target;
    if (roll < 0.18) target = { x: zones.head.x, y: zones.head.y, name: "head" };
    else if (roll < 0.6) target = { x: zones.body.x, y: zones.body.y, name: "body" };
    else target = { x: zones.legs.x, y: zones.legs.y, name: "legs" };

    const cp = computer.throwPoint;
    const dx = Math.abs(cp.x - target.x);
    const dy = cp.y - target.y; // positive if target is above launch point... note y grows downward
    const dyUp = -dy; // convert to "up positive"

    const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED) * 0.6 + 120;
    let angle = solveAngleForTarget(dx, dyUp, speed);
    if (angle === null || isNaN(angle)) {
      angle = 30 * (Math.PI / 180);
    }
    // inaccuracy
    angle += (Math.random() - 0.5) * (9 * Math.PI / 180);
    const finalSpeed = speed * (0.95 + Math.random() * 0.1);

    computerTargetAngle = angle;
    computerTargetSpeed = finalSpeed;
    computer.aimAngle = angle;
    computer.aiming = true;
    computer.state = "charging";
    computerCharging = true;
    computerChargeElapsed = 0;
    computerChargeDuration = 0.5 + Math.random() * 0.5;
  }

  function pickPlatforms() {
    const leftSpot = LEFT_SPOTS[Math.floor(Math.random() * LEFT_SPOTS.length)];
    const rightSpot = RIGHT_SPOTS[Math.floor(Math.random() * RIGHT_SPOTS.length)];
    player.setPosition(W * leftSpot.xFrac, WORLD_FLOOR_Y - leftSpot.h);
    computer.setPosition(W * rightSpot.xFrac, WORLD_FLOOR_Y - rightSpot.h);
  }

  function resetMatch() {
    pickPlatforms();
    player.reset();
    computer.reset();
    spears = [];
    playerCharging = false;
    playerSpearInFlight = false;
    computerSpearInFlight = false;
    computerCharging = false;
    computer.aiming = false;
    computerTimer = 1.0 + Math.random() * 0.8;
    carAnim = null;
    coinThrowCount = 0;
    shotsSinceComment = 0;
    nextCommentaryGap = randomCommentaryGap();
    hideMonikaSpeech();
    updateHud();
  }

  function showMonikaLine(category) {
    const pool = MONIKA_LINES[category];
    if (!pool || pool.length === 0) return;
    let line = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1) {
      while (line === lastLineByCategory[category]) {
        line = pool[Math.floor(Math.random() * pool.length)];
      }
    }
    lastLineByCategory[category] = line;

    const headZone = computer.zones.head;
    const px = clamp((headZone.x / W) * 100, 12, 88);
    const py = ((headZone.y - headZone.r) / H) * 100;
    monikaSpeech.style.left = px + "%";
    monikaSpeech.style.top = py + "%";

    monikaSpeech.textContent = line;
    monikaSpeech.classList.add("visible");
    clearTimeout(speechHideTimer);
    speechHideTimer = setTimeout(hideMonikaSpeech, 3200);
  }

  function hideMonikaSpeech() {
    monikaSpeech.classList.remove("visible");
  }

  function endMatch(winner) {
    state = "gameover";
    resultTitle.textContent =
      winner === "player" ? "Shopping's over, we're going to the beach!" : "Damn, you win Monika, let's buy more shoes...";
    resultTitle.classList.remove("result-pink", "result-blue");
    resultTitle.classList.add(winner === "player" ? "result-blue" : "result-pink");

    if (winner === "player") playerWins++;
    else computerWins++;
    playerWinsEl.textContent = "Wins: " + playerWins;
    computerWinsEl.textContent = "Wins: " + computerWins;

    if (winner === "player") {
      playMoan();
      const pickupDelay = 500;
      const driveDuration = 1300;
      carAnim = { startTime: performance.now() + pickupDelay, duration: driveDuration, x0: computer.x, y: computer.standY };
      setTimeout(() => {
        gameOverScreen.classList.remove("hidden");
      }, pickupDelay + driveDuration + 250);
    } else {
      setTimeout(() => {
        gameOverScreen.classList.remove("hidden");
      }, 550);
    }
  }

  function drawCar(x, y) {
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = "#e6362f";
    ctx.fillRect(-45, -34, 90, 26);
    ctx.beginPath();
    ctx.moveTo(-25, -34);
    ctx.lineTo(-15, -50);
    ctx.lineTo(15, -50);
    ctx.lineTo(25, -34);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#cfefff";
    ctx.beginPath();
    ctx.moveTo(-20, -34);
    ctx.lineTo(-12, -47);
    ctx.lineTo(12, -47);
    ctx.lineTo(20, -34);
    ctx.closePath();
    ctx.fill();

    if (computerHeadImg.complete && computerHeadImg.naturalWidth > 0) {
      const r = 8;
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, -40, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      const c = computer.headCrop;
      ctx.drawImage(computerHeadImg, c.sx, c.sy, c.sw, c.sh, -r, -40 - r, r * 2, r * 2);
      ctx.restore();
    }

    ctx.fillStyle = "#1c1c1c";
    ctx.beginPath();
    ctx.arc(-28, -8, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(28, -8, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#000000";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("UBER", 0, -21);

    ctx.restore();
  }

  // ---- Input ----
  function onDown(evt) {
    if (state !== "playing") return;
    if (playerSpearInFlight || player.state === "dead") return;
    evt.preventDefault();
    mouse = canvasPointFromEvent(evt);
    updatePlayerAim();
    playerCharging = true;
    playerChargeStart = performance.now();
    player.state = "charging";
    powerBarOuter.classList.remove("hidden");
    powerBarInner.style.width = "0%";
  }

  function onMove(evt) {
    mouse = canvasPointFromEvent(evt);
    if (state === "playing" && player.state !== "dead") {
      updatePlayerAim();
    }
  }

  function onUp(evt) {
    if (!playerCharging) return;
    playerCharging = false;
    powerBarOuter.classList.add("hidden");
    const elapsed = (performance.now() - playerChargeStart) / 1000;
    const power = clamp(elapsed / CHARGE_TIME, 0.12, 1);
    const speed = MIN_SPEED + power * (MAX_SPEED - MIN_SPEED);
    throwSpear(player, player.aimAngle, speed);
    playerSpearInFlight = true;
    player.state = "idle";
  }

  canvas.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  canvas.addEventListener("touchstart", onDown, { passive: false });
  window.addEventListener("touchmove", onMove, { passive: false });
  window.addEventListener("touchend", onUp);

  playBtn.addEventListener("click", () => {
    ensureAudioContext();
    menuScreen.classList.add("hidden");
    resetMatch();
    state = "playing";
    player.aiming = true;
  });

  againBtn.addEventListener("click", () => {
    ensureAudioContext();
    gameOverScreen.classList.add("hidden");
    resetMatch();
    state = "playing";
    player.aiming = true;
  });

  // ---- Update ----
  function updateComputerAI(dt) {
    if (computer.state === "dead") return;
    if (computerCharging) {
      computerChargeElapsed += dt;
      if (computerChargeElapsed >= computerChargeDuration) {
        computerCharging = false;
        computer.aiming = false;
        computer.state = "idle";
        throwSpear(computer, computerTargetAngle, computerTargetSpeed);
        computerSpearInFlight = true;
      }
      return;
    }
    if (computerSpearInFlight) return;
    computerTimer -= dt;
    if (computerTimer <= 0) {
      startComputerAim();
      computerTimer = 1.4 + Math.random() * 1.2;
    }
  }

  function registerPlayerShot(category) {
    shotsSinceComment++;
    if (shotsSinceComment >= nextCommentaryGap) {
      shotsSinceComment = 0;
      nextCommentaryGap = randomCommentaryGap();
      const useRandom = Math.random() < RANDOM_LINE_CHANCE;
      showMonikaLine(useRandom ? "random" : category);
    }
  }

  function updateSpears(dt) {
    const newSpears = [];
    for (const s of spears) {
      if (!s.active) continue;
      const prevVy = s.vy;
      const prevX = s.x;
      const prevY = s.y;
      s.update(dt);

      // explosive coins burst into shrapnel once they crest their arc
      if (s.explosive && !s.exploded && prevVy < 0 && s.vy >= 0) {
        s.exploded = true;
        s.active = false;
        resolveThrow(s.owner);
        newSpears.push(...spawnShrapnel(s.x, s.y));
        playCoin();
        continue;
      }

      const tip = s.tip;

      // track whether a player coin has flown past Monika's column, and at what height
      if (s.owner === "player" && !s.crossedTarget) {
        const dxPrev = prevX - computer.x;
        const dxNow = s.x - computer.x;
        if (dxPrev === 0 || Math.sign(dxPrev) !== Math.sign(dxNow)) {
          s.crossedTarget = true;
          const headTop = computer.zones.head.y - computer.zones.head.r;
          s.crossedHigh = tip.y < headTop;
        }
      }

      // ground collision
      if (tip.y >= WORLD_FLOOR_Y) {
        s.active = false;
        resolveThrow(s.owner);
        if (s.owner === "player") {
          if (s.crossedHigh) registerPlayerShot("tooHigh");
          else registerPlayerShot(Math.abs(s.x - computer.x) < 70 ? "tooFlat" : "tooWeak");
        }
        continue;
      }
      // offscreen
      if (s.x < -50 || s.x > W + 50 || s.y < -50) {
        s.active = false;
        resolveThrow(s.owner);
        if (s.owner === "player") {
          registerPlayerShot(s.crossedHigh ? "tooHigh" : "miss");
        }
        continue;
      }
      // hit target(s) - swept along the path this frame travelled, so fast coins
      // can't tunnel past a hit zone; a neutral shrapnel fragment can hit either side
      const found = findHitAlongPath(s.owner, prevX, prevY, tip.x, tip.y);
      if (found) {
        s.active = false;
        resolveThrow(s.owner);
        updateHud();
        playThump();
        if (found.result.killed) {
          endMatch(found.target === computer ? "player" : "computer");
        } else if (s.owner === "player" && found.target === computer) {
          registerPlayerShot(found.result.zone === "legs" ? "legHit" : "bodyHit");
        }
      }
    }
    spears = spears.filter((s) => s.active).concat(newSpears);
  }

  function resolveThrow(owner) {
    if (owner === "player") playerSpearInFlight = false;
    else if (owner === "computer") computerSpearInFlight = false;
  }

  function drawImageCover(img, dx, dy, dw, dh) {
    const scale = Math.max(dw / img.naturalWidth, dh / img.naturalHeight);
    const sw = dw / scale;
    const sh = dh / scale;
    const sx = (img.naturalWidth - sw) / 2;
    const sy = (img.naturalHeight - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  function drawBackground() {
    ctx.fillStyle = "#cdeeff";
    ctx.fillRect(0, 0, W, H);

    if (backgroundImg.complete && backgroundImg.naturalWidth > 0) {
      ctx.save();
      ctx.globalAlpha = 0.49;
      drawImageCover(backgroundImg, 0, 0, W, H);
      ctx.restore();
    }

    drawPlatform(player);
    drawPlatform(computer);
  }

  function drawPlatform(stickman) {
    const x = stickman.x - PLATFORM_WIDTH / 2;
    ctx.fillStyle = "#9a8368";
    ctx.fillRect(x, stickman.standY, PLATFORM_WIDTH, H - stickman.standY);
    ctx.fillStyle = "#7bbf6a";
    ctx.fillRect(x, stickman.standY, PLATFORM_WIDTH, 6);
    ctx.strokeStyle = "#5a9a4c";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, stickman.standY, PLATFORM_WIDTH, 6);
  }

  function drawAimGuide() {
    if (state !== "playing" || player.state === "dead" || playerSpearInFlight) return;
    const tp = player.throwPoint;
    const len = 70;
    const ex = tp.x + Math.cos(player.aimAngle) * len;
    const ey = tp.y - Math.sin(player.aimAngle) * len;
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.setLineDash([5, 6]);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(tp.x, tp.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.restore();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.032, (frame.last ? (now - frame.last) : 16) / 1000);
    frame.last = now;

    if (state === "playing") {
      updateComputerAI(dt);
      updateSpears(dt);
      if (playerCharging) {
        const elapsed = (performance.now() - playerChargeStart) / 1000;
        const power = clamp(elapsed / CHARGE_TIME, 0, 1);
        powerBarInner.style.width = power * 100 + "%";
      }
    }
    if (state === "playing" || state === "gameover") {
      player.update(dt);
      computer.update(dt);
    }

    drawBackground();
    drawAimGuide();
    ctx.save();
    try {
      player.draw(ctx);
    } catch (err) {
      console.error("player.draw failed", err);
    } finally {
      ctx.restore();
    }

    let showComputer = true;
    if (carAnim && now >= carAnim.startTime) {
      showComputer = false;
      const progress = clamp((now - carAnim.startTime) / carAnim.duration, 0, 1);
      const carX = carAnim.x0 + progress * (W - carAnim.x0 + 140);
      drawCar(carX, carAnim.y);
    }
    if (showComputer) {
      ctx.save();
      try {
        computer.draw(ctx);
      } catch (err) {
        console.error("computer.draw failed", err);
      } finally {
        ctx.restore();
      }
    }

    for (const s of spears) s.draw(ctx);
  }

  updateHud();
  requestAnimationFrame(frame);
})();
