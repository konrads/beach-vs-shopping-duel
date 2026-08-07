// Shared world constants
const GRAVITY = 1900; // px/s^2
const WORLD_FLOOR_Y = 460; // absolute floor; spears that fall this far stick into the ground
const SCALE = 0.72; // shrinks the stick figures

class Stickman {
  constructor(x, standY, facing, color) {
    this.x = x;
    this.standY = standY; // y of the ground/platform this character stands on
    this.facing = facing; // 1 = faces right, -1 = faces left
    this.color = color;
    this.maxHp = 5;
    this.hp = this.maxHp;
    this.state = "idle"; // idle | charging | hit | dead
    this.hitFlashTimer = 0;
    this.deadTimer = 0;
    this.aimAngle = -35 * (Math.PI / 180); // radians, measured upward from horizontal
    this.aiming = false; // when true, throwing arm follows aimAngle
    this.headImage = null; // optional Image drawn in place of the plain head circle
    this.headCrop = null; // optional { sx, sy, sw, sh } source rect within headImage to frame the face
    this.headOffsetY = 0; // shifts the head up (negative) or down (positive) from its default position
    this.headScale = 1; // multiplier on head radius, for headImage portraits
    this.showHeadOutline = true; // whether to stroke a border around the headImage
    this._cachedHeadCanvas = null; // lazily-built, feathered-edge head bitmap
    this._cachedHeadR = null;
    this.wearsDress = false; // draws a polka-dot dress over the torso/hips
    this.dressColor = "#d6373f";
    this.dressDotColor = "#ffffff";
  }

  reset() {
    this.hp = this.maxHp;
    this.state = "idle";
    this.hitFlashTimer = 0;
    this.deadTimer = 0;
  }

  setPosition(x, standY) {
    this.x = x;
    this.standY = standY;
  }

  // Throw origin point (hand height), in world space
  get throwPoint() {
    return { x: this.x + this.facing * 10, y: this.standY - 67 * SCALE };
  }

  // Hit zones in world space
  get zones() {
    const g = this.standY;
    return {
      head: { x: this.x, y: g - 82 * SCALE + this.headOffsetY, r: 15 * SCALE * this.headScale },
      body: { x: this.x, y: g - 62 * SCALE, halfW: 14 * SCALE, top: g - 73 * SCALE, bottom: g - 44 * SCALE },
      legs: { x: this.x, y: g - 22 * SCALE, halfW: 11 * SCALE, top: g - 44 * SCALE, bottom: g },
    };
  }

  // Returns { zone, damage, killed } or null if point doesn't hit
  checkHit(px, py) {
    const z = this.zones;
    const dx = px - z.head.x;
    const dy = py - z.head.y;
    if (dx * dx + dy * dy <= z.head.r * z.head.r) {
      return this.applyDamage("head", this.hp);
    }
    if (py >= z.body.top && py <= z.body.bottom && Math.abs(px - z.body.x) <= z.body.halfW) {
      return this.applyDamage("body", 2);
    }
    if (py >= z.legs.top && py <= z.legs.bottom && Math.abs(px - z.legs.x) <= z.legs.halfW) {
      return this.applyDamage("legs", 1);
    }
    return null;
  }

  applyDamage(zone, amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.hitFlashTimer = 0.2;
    const killed = this.hp <= 0;
    this.state = killed ? "dead" : "hit";
    if (killed) this.deadTimer = 0;
    return { zone, damage: amount, killed };
  }

  update(dt) {
    if (this.hitFlashTimer > 0) this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    if (this.state === "hit" && this.hitFlashTimer === 0) this.state = "idle";
    if (this.state === "dead") this.deadTimer += dt;
  }

  draw(ctx) {
    const groundY = this.standY;
    const flash = this.hitFlashTimer > 0;
    const strokeColor = flash ? "#ff3b3b" : this.color;
    ctx.save();
    try {
    ctx.translate(this.x, 0);

    let fallProgress = 0;
    if (this.state === "dead") {
      fallProgress = Math.min(1, this.deadTimer / 0.5);
    }
    if (fallProgress > 0) {
      ctx.translate(0, groundY);
      ctx.rotate(this.facing * fallProgress * (Math.PI / 2.1));
      ctx.translate(0, -groundY);
      ctx.globalAlpha = 1 - fallProgress * 0.35;
    }

    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = strokeColor;
    ctx.lineWidth = 3 * SCALE + 1.5;
    ctx.lineCap = "round";

    const hipY = groundY - 44 * SCALE;
    const shoulderY = groundY - 73 * SCALE;
    const headY = groundY - 82 * SCALE + this.headOffsetY;
    const headR = 15 * SCALE * this.headScale;

    // legs
    ctx.beginPath();
    ctx.moveTo(0, hipY);
    ctx.lineTo(-7 * SCALE, groundY);
    ctx.moveTo(0, hipY);
    ctx.lineTo(7 * SCALE, groundY);
    ctx.stroke();

    // torso
    ctx.beginPath();
    ctx.moveTo(0, hipY);
    ctx.lineTo(0, shoulderY);
    ctx.stroke();

    // dress (worn over the torso/hips)
    if (this.wearsDress) {
      const topHalf = 4 * SCALE;
      const hemHalf = 15 * SCALE;
      const hemY = hipY + 22 * SCALE;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-topHalf, shoulderY);
      ctx.lineTo(topHalf, shoulderY);
      ctx.lineTo(hemHalf, hemY);
      ctx.lineTo(-hemHalf, hemY);
      ctx.closePath();
      ctx.fillStyle = this.dressColor;
      ctx.fill();
      ctx.clip();
      ctx.fillStyle = this.dressDotColor;
      const dotR = 1.6 * SCALE;
      const rows = 4;
      for (let r = 0; r < rows; r++) {
        const t = r / (rows - 1);
        const rowY = shoulderY + t * (hemY - shoulderY);
        const cols = 2 + r;
        for (let c = 0; c < cols; c++) {
          const jitter = r % 2 === 0 ? 0 : (hemHalf / cols) * 0.5;
          const cx = -hemHalf + ((c + 0.5) / cols) * (hemHalf * 2) + jitter;
          ctx.beginPath();
          ctx.arc(cx, rowY, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // back arm
    ctx.beginPath();
    ctx.moveTo(0, shoulderY + 6 * SCALE);
    ctx.lineTo(-9 * SCALE * this.facing, shoulderY + 28 * SCALE);
    ctx.stroke();

    // front arm (throwing arm), angled by aimAngle while charging
    let armAngle = -20 * (Math.PI / 180);
    if (this.aiming) {
      armAngle = this.aimAngle;
    }
    const armLen = 26 * SCALE;
    const ax = this.facing * Math.cos(armAngle) * armLen;
    const ay = -Math.sin(armAngle) * armLen;
    ctx.beginPath();
    ctx.moveTo(0, shoulderY + 6 * SCALE);
    ctx.lineTo(ax, shoulderY + 6 * SCALE + ay);
    ctx.stroke();

    // head
    if (this.headImage && this.headImage.complete && this.headImage.naturalWidth > 0) {
      if (!this._cachedHeadCanvas || this._cachedHeadR !== headR) {
        this._cachedHeadCanvas = this._buildFeatheredHeadCanvas(headR);
        this._cachedHeadR = headR;
      }
      ctx.drawImage(this._cachedHeadCanvas, -headR, headY - headR);
      if (this.showHeadOutline) {
        ctx.beginPath();
        ctx.arc(0, headY, headR, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.arc(0, headY, headR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    } finally {
      ctx.restore();
    }
  }

  // Builds (once, then cached) an offscreen bitmap of the head photo as a full
  // square (no circular clip, so the chin/hair/ears are never cut off). Pixels
  // that look like the source photo's cool-toned sky/mountain background are
  // faded to transparent based on color, rather than clipping to a fixed shape.
  _buildFeatheredHeadCanvas(headR) {
    const size = headR * 2;
    const off = document.createElement("canvas");
    off.width = size;
    off.height = size;
    const octx = off.getContext("2d");
    if (this.headCrop) {
      const c = this.headCrop;
      octx.drawImage(this.headImage, c.sx, c.sy, c.sw, c.sh, 0, 0, size, size);
    } else {
      octx.drawImage(this.headImage, 0, 0, size, size);
    }
    // Best-effort: some browsers/contexts restrict pixel readback on canvases
    // that drew from local image assets. If so, skip the background-removal
    // effect rather than let the error escape and break the rest of the frame.
    try {
      const imgData = octx.getImageData(0, 0, size, size);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const brightness = (r + g + b) / 3;
        const blueDominance = b - r; // sky/haze reads cool (blue > red); skin/hair reads warm
        if (brightness > 65 && blueDominance > 0) {
          const t = Math.max(0, Math.min(1, (blueDominance - 3) / 18));
          d[i + 3] = d[i + 3] * (1 - t);
        }
      }
      octx.putImageData(imgData, 0, 0);
    } catch (err) {
      // leave the plain square drawImage() result as-is
    }
    return off;
  }
}

class Spear {
  constructor(x, y, vx, vy, owner) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.owner = owner; // "player" | "computer" | "neutral" (shrapnel, can hit either side)
    this.active = true;
    this.radius = 9;
    this.spinAngle = Math.random() * Math.PI * 2;
    this.explosive = false; // bursts into shrapnel at the top of its arc
    this.exploded = false;
    this.crossedTarget = false; // whether a player-owned coin has flown past Monika's x column
    this.crossedHigh = false; // if crossedTarget, whether it passed above her head
  }

  update(dt) {
    if (!this.active) return;
    this.vy += GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.spinAngle += dt * 16;
  }

  get tip() {
    return { x: this.x, y: this.y };
  }

  draw(ctx) {
    const squash = Math.max(0.15, Math.abs(Math.cos(this.spinAngle)));
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(squash, 1);
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#f6c92e";
    ctx.fill();
    ctx.lineWidth = this.explosive ? 3 : 2;
    ctx.strokeStyle = this.explosive ? "#ff3b3b" : "#b8860b";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.6, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff3b0";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }
}
