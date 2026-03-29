import {
  rand, dist2, wrap, transformPolyline, segSegDist2,
  makeCurvedAsteroid, makeShipShape, makeAlienShape, makeTextModel
} from './vector.js';

export function createAssets() {
  return {
    shipShape: makeShipShape(),
    alienShape: makeAlienShape(),
    gameOverText: makeTextModel('GAME OVER', 1)
  };
}

export function createInitialState(width, height) {
  return {
    width, height,
    ship: {
      x: width * 0.5, y: height * 0.5, vx: 0, vy: 0, rot: 0,
      colorIndex: 1, alive: true, invuln: 2.0, respawnTimer: 0, boundRadius: 23
    },
    asteroids: [],
    trails: [],
    projectiles: [],
    alien: null,
    score: 0,
    lives: 3,
    round: 1,
    roundDelay: -1,
    alienCooldown: rand(10, 16),
    gameOver: { active: false, t: 0 },
    shipThrustVisual: false
  };
}

export function resetGame(state) {
  state.asteroids.length = 0;
  state.trails.length = 0;
  state.projectiles.length = 0;
  state.alien = null;
  state.score = 0;
  state.lives = 3;
  state.round = 1;
  state.roundDelay = -1;
  state.alienCooldown = rand(8, 14);
  state.gameOver.active = false;
  state.gameOver.t = 0;
  resetShip(state);
  spawnWave(state);
}

export function resetShip(state) {
  Object.assign(state.ship, {
    x: state.width * 0.5, y: state.height * 0.5,
    vx: 0, vy: 0, rot: 0, alive: true, invuln: 2.0, respawnTimer: 0
  });
}

export function spawnWave(state) {
  const count = 8 + state.round * 2;
  for (let i = 0; i < count; i++) {
    let x = rand(0, state.width), y = rand(0, state.height);
    if ((x - state.width * 0.5) ** 2 + (y - state.height * 0.5) ** 2 < 240 * 240) {
      x += 260; y += 160;
    }
    state.asteroids.push(makeCurvedAsteroid(x, y, rand(20, 34 + state.round * 3), (i * 2 + state.round) % 16));
  }
}

export function fireProjectile(state, owner, x, y, vx, vy, colorIndex) {
  state.projectiles.push({ owner, x, y, vx, vy, life: 1.0, colorIndex });
}

export function firePlayer(state, nowMs) {
  if (state.gameOver.active || !state.ship.alive) return;
  if (state._lastFire && nowMs - state._lastFire < 110) return;
  state._lastFire = nowMs;
  const dx = Math.cos(state.ship.rot), dy = Math.sin(state.ship.rot);
  fireProjectile(state, 'player', state.ship.x + dx * 20, state.ship.y + dy * 20, dx * 8 + state.ship.vx, dy * 8 + state.ship.vy, (state.ship.colorIndex + 8) % 16);
}

export function explodeAt(state, x, y, colorIndex, count = 16, scale = 1, harmful = false) {
  for (let k = 0; k < count; k++) {
    state.trails.push({
      x: x + rand(-10, 10) * scale,
      y: y + rand(-10, 10) * scale,
      vx: rand(-2.8, 2.8) * scale,
      vy: rand(-2.8, 2.8) * scale,
      life: rand(0.45, 1.0),
      colorIndex: (colorIndex + k) % 16,
      size: rand(4, 20) * scale,
      harmful,
      radius: rand(5, 10) * scale
    });
  }
}

function splitAsteroid(state, index, hitX, hitY, extraImpulse = 0, scoringOwner = null) {
  const a = state.asteroids[index];
  explodeAt(state, hitX, hitY, a.colorIndex, 14, Math.max(0.8, a.radius / 40), false);
  if (a.radius > 24) {
    const r1 = a.radius * rand(0.52, 0.66), r2 = a.radius * rand(0.42, 0.58);
    const c1 = makeCurvedAsteroid(a.x, a.y, r1, (a.colorIndex + 3) % 16);
    const c2 = makeCurvedAsteroid(a.x, a.y, r2, (a.colorIndex + 7) % 16);
    c1.vx += rand(-1.8, -0.3) + extraImpulse;
    c1.vy += rand(-1.6, 1.6);
    c2.vx += rand(0.3, 1.8) - extraImpulse;
    c2.vy += rand(-1.6, 1.6);
    state.asteroids.push(c1, c2);
  }
  state.asteroids.splice(index, 1);
  if (scoringOwner === 'player') state.score += 10;
}

function chooseAlienTarget(state) {
  const options = [];
  if (state.ship.alive) options.push({ x: state.ship.x, y: state.ship.y });
  for (const a of state.asteroids) options.push({ x: a.x, y: a.y });
  if (options.length === 0) return null;
  return options[Math.floor(Math.random() * options.length)];
}

function spawnAlien(state) {
  if (state.alien || state.gameOver.active || state.roundDelay > 0) return;
  const fromLeft = Math.random() < 0.5;
  state.alien = {
    x: fromLeft ? -60 : state.width + 60,
    y: rand(80, state.height - 80),
    vx: fromLeft ? rand(2.2, 3.2) : rand(-3.2, -2.2),
    vy: rand(-0.8, 0.8),
    rot: 0,
    colorIndex: 6 + Math.floor(Math.random() * 6),
    boundRadius: 26,
    worth: 80,
    shootTimer: rand(0.8, 1.4)
  };
}

function killAlien(state) {
  if (!state.alien) return;
  explodeAt(state, state.alien.x, state.alien.y, state.alien.colorIndex, 28, 1.35, true);
  state.score += state.alien.worth;
  state.alien = null;
}

function killShip(state) {
  const ship = state.ship;
  if (!ship.alive || ship.invuln > 0 || state.gameOver.active) return;
  ship.alive = false;
  ship.respawnTimer = 1.35;
  explodeAt(state, ship.x, ship.y, ship.colorIndex, 22, 1.2, false);
  state.lives -= 1;
  if (state.lives <= 0) {
    state.gameOver.active = true;
    state.gameOver.t = 0;
  }
}

function maybeQueueNextRound(state) {
  if (!state.gameOver.active && state.roundDelay < 0 && state.asteroids.length === 0) {
    state.roundDelay = 2.1;
    if (state.lives < 4) state.lives += 1;
  }
}

export function updateGame(state, input, assets, dt, nowMs) {
  state.shipThrustVisual = false;
  updateShip(state, input, dt);
  updateAsteroids(state, dt);
  updateAlien(state, dt);
  updateProjectiles(state, dt);
  updateTrails(state, dt);

  collideProjectiles(state);
  collideShip(state, assets);
  collideHarmfulFragments(state);
  updateRounds(state, dt);
  updateGameOver(state, dt);

  maybeQueueNextRound(state);

  if (!state.alien) {
    state.alienCooldown -= dt;
    if (state.alienCooldown <= 0) {
      spawnAlien(state);
      state.alienCooldown = rand(14, 22);
    }
  }
}

function updateShip(state, input, dt) {
  const ship = state.ship;
  if (state.gameOver.active) return;

  if (!ship.alive) {
    ship.respawnTimer -= dt;
    if (ship.respawnTimer <= 0 && state.lives > 0) resetShip(state);
    return;
  }

  let thrusting = false;
  const keys = input.keys;
  const keyboardMode = keys['ArrowUp'] || keys['KeyW'] || keys['ArrowLeft'] || keys['ArrowRight'] || keys['KeyA'] || keys['KeyD'] || keys['ArrowDown'] || keys['KeyS'];

  if (keys['ArrowLeft'] || keys['KeyA']) ship.rot -= 5.1 * dt;
  if (keys['ArrowRight'] || keys['KeyD']) ship.rot += 5.1 * dt;
  if (keys['ArrowUp'] || keys['KeyW']) {
    ship.vx += Math.cos(ship.rot) * 13.2 * dt;
    ship.vy += Math.sin(ship.rot) * 13.2 * dt;
    thrusting = true;
  }
  if (keys['ArrowDown'] || keys['KeyS']) {
    ship.vx *= Math.pow(0.96, dt * 60);
    ship.vy *= Math.pow(0.96, dt * 60);
  }

  if (!keyboardMode) {
    const dx = input.pointer.x - ship.x, dy = input.pointer.y - ship.y;
    const d = Math.hypot(dx, dy) || 1;
    const accel = input.pointer.down ? 0.29 : 0.11;
    const damping = input.pointer.down ? Math.pow(0.972, dt * 60) : Math.pow(0.985, dt * 60);
    ship.vx = (ship.vx + dx / d * Math.min(d, 180) * accel * dt) * damping;
    ship.vy = (ship.vy + dy / d * Math.min(d, 180) * accel * dt) * damping;
    ship.rot = Math.atan2(input.pointer.y - ship.y, input.pointer.x - ship.x);
    thrusting = input.pointer.down;
  } else {
    ship.vx *= Math.pow(0.992, dt * 60);
    ship.vy *= Math.pow(0.992, dt * 60);
  }

  const speed = Math.hypot(ship.vx, ship.vy), maxSpeed = 7.2;
  if (speed > maxSpeed) {
    ship.vx = ship.vx / speed * maxSpeed;
    ship.vy = ship.vy / speed * maxSpeed;
  }

  ship.x += ship.vx * dt * 60;
  ship.y += ship.vy * dt * 60;
  wrap(ship, state.width, state.height);

  if (ship.invuln > 0) ship.invuln = Math.max(0, ship.invuln - dt);

  if (thrusting) {
    state.trails.push({
      x: ship.x - Math.cos(ship.rot) * 16,
      y: ship.y - Math.sin(ship.rot) * 16,
      vx: rand(-0.2, 0.2), vy: rand(-0.2, 0.2),
      life: 1, colorIndex: (ship.colorIndex + 10) % 16, size: rand(6, 12),
      harmful: false, radius: 0
    });
    state.shipThrustVisual = true;
  }
}

function updateAsteroids(state, dt) {
  for (const a of state.asteroids) {
    a.x += a.vx * dt * 60;
    a.y += a.vy * dt * 60;
    a.rot += a.rotv * dt * 60;
    wrap(a, state.width, state.height);
  }
}

function updateAlien(state, dt) {
  if (!state.alien) return;
  const alien = state.alien;
  let avoidX = 0, avoidY = 0;
  for (const a of state.asteroids) {
    const dx = alien.x - a.x, dy = alien.y - a.y;
    const d2 = dx * dx + dy * dy;
    const rr = (a.radius + 90) * (a.radius + 90);
    if (d2 < rr) {
      const d = Math.sqrt(d2) || 1;
      avoidX += dx / d * 0.12;
      avoidY += dy / d * 0.12;
    }
  }
  alien.vx += avoidX * dt * 60;
  alien.vy += avoidY * dt * 60;
  const s = Math.hypot(alien.vx, alien.vy), maxS = 3.6;
  if (s > maxS) {
    alien.vx = alien.vx / s * maxS;
    alien.vy = alien.vy / s * maxS;
  }
  alien.x += alien.vx * dt * 60;
  alien.y += alien.vy * dt * 60;
  alien.rot = Math.atan2(alien.vy, alien.vx);

  alien.shootTimer -= dt;
  if (alien.shootTimer <= 0) {
    const target = chooseAlienTarget(state);
    if (target) {
      const dx = target.x - alien.x, dy = target.y - alien.y;
      const d = Math.hypot(dx, dy) || 1;
      fireProjectile(state, 'alien', alien.x, alien.y, dx / d * 5.2 + alien.vx * 0.2, dy / d * 5.2 + alien.vy * 0.2, alien.colorIndex);
    }
    alien.shootTimer = rand(0.7, 1.4);
  }

  if (alien.x < -120 || alien.x > state.width + 120 || alien.y < -120 || alien.y > state.height + 120) {
    state.alien = null;
  }
}

function updateProjectiles(state, dt) {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.life -= 0.018 * dt * 60;
    wrap(p, state.width, state.height);
    if (p.life <= 0) state.projectiles.splice(i, 1);
  }
}

function updateTrails(state, dt) {
  for (let i = state.trails.length - 1; i >= 0; i--) {
    const t = state.trails[i];
    t.life -= 0.028 * dt * 60;
    t.size *= Math.pow(0.985, dt * 60);
    t.x += (t.vx || 0) * dt * 60;
    t.y += (t.vy || 0) * dt * 60;
    if (t.life <= 0 || t.size < 0.5) state.trails.splice(i, 1);
  }
  if (state.trails.length > 260) state.trails.splice(0, state.trails.length - 260);
}

function collideProjectiles(state) {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    let removed = false;

    for (let j = state.asteroids.length - 1; j >= 0; j--) {
      const a = state.asteroids[j];
      if (Math.hypot(p.x - a.x, p.y - a.y) < a.radius * 0.92) {
        splitAsteroid(state, j, p.x, p.y, p.owner === 'alien' ? 0.4 : 0, p.owner);
        state.projectiles.splice(i, 1);
        removed = true;
        break;
      }
    }
    if (removed) continue;

    if (p.owner !== 'player' && state.ship.alive && state.ship.invuln <= 0 && Math.hypot(p.x - state.ship.x, p.y - state.ship.y) < state.ship.boundRadius + 4) {
      killShip(state);
      state.projectiles.splice(i, 1);
      continue;
    }

    if (p.owner === 'player' && state.alien && Math.hypot(p.x - state.alien.x, p.y - state.alien.y) < state.alien.boundRadius + 4) {
      killAlien(state);
      state.projectiles.splice(i, 1);
    }
  }
}

function collideShip(state, assets) {
  const ship = state.ship;
  if (!ship.alive || ship.invuln > 0 || state.gameOver.active) return;

  const shipCenter = { x: ship.x, y: ship.y };
  const shipPoly = transformPolyline(assets.shipShape.hullLocal, ship);
  const threshold2 = 5.5 * 5.5;

  asteroidLoop:
  for (const a of state.asteroids) {
    const r = a.radius + ship.boundRadius + 6;
    if (dist2(shipCenter, a) > r * r) continue;
    const aPoly = transformPolyline(a.flatLocal, a);
    for (let i = 0; i < shipPoly.length - 1; i++) {
      const sa = shipPoly[i], sb = shipPoly[i + 1];
      for (let j = 0; j < aPoly.length - 1; j++) {
        const aa = aPoly[j], ab = aPoly[j + 1];
        if (segSegDist2(sa, sb, aa, ab) <= threshold2) {
          killShip(state);
          break asteroidLoop;
        }
      }
    }
  }

  if (state.alien && ship.alive) {
    const r = state.alien.boundRadius + ship.boundRadius + 8;
    if (dist2(shipCenter, state.alien) <= r * r) {
      const alienPoly = transformPolyline(assets.alienShape.hullLocal, state.alien);
      for (let i = 0; i < shipPoly.length - 1; i++) {
        const sa = shipPoly[i], sb = shipPoly[i + 1];
        for (let j = 0; j < alienPoly.length - 1; j++) {
          const aa = alienPoly[j], ab = alienPoly[j + 1];
          if (segSegDist2(sa, sb, aa, ab) <= threshold2) {
            killShip(state);
            killAlien(state);
            return;
          }
        }
      }
    }
  }
}

function collideHarmfulFragments(state) {
  if (state.ship.alive && state.ship.invuln <= 0) {
    for (const t of state.trails) {
      if (!t.harmful) continue;
      if (Math.hypot(t.x - state.ship.x, t.y - state.ship.y) < state.ship.boundRadius + t.radius * 0.35) {
        killShip(state);
        break;
      }
    }
  }

  for (let i = state.trails.length - 1; i >= 0; i--) {
    const t = state.trails[i];
    if (!t.harmful) continue;
    let hit = false;
    for (let j = state.asteroids.length - 1; j >= 0; j--) {
      const a = state.asteroids[j];
      if (Math.hypot(t.x - a.x, t.y - a.y) < a.radius + t.radius * 0.35) {
        splitAsteroid(state, j, t.x, t.y, 0.4, null);
        hit = true;
        break;
      }
    }
    if (hit) state.trails.splice(i, 1);
  }
}

function updateRounds(state, dt) {
  if (state.roundDelay > 0) {
    state.roundDelay -= dt;
    if (state.roundDelay <= 0) {
      state.round += 1;
      spawnWave(state);
    }
  }
}

function updateGameOver(state, dt) {
  if (state.gameOver.active) state.gameOver.t += dt;
}