const cfg = require('./config');

function weaponSpec(gun) {
  const spec = cfg.gun.ballistics[gun];
  if (!spec) throw new Error(`未知武器档位: ${gun}`);
  return spec;
}

function hitChance(att, tgt, entry = false, map = null, time = 0, exposure = null) {
  const gun = weaponSpec(att.gun);
  if(map?.data.fireModel==='timed-v3') {
    const d=Math.hypot(att.position.x-tgt.position.x,att.position.y-tgt.position.y);
    let p=(gun.accuracy+(att.aim-70)*.0025)/(1+d/(att.gun===2?650:att.gun===1?350:450));
    if(att.moving)p*=.55;else if(att.holdTicks<.4)p*=.8;
    if(att.stun>0)p*=cfg.utility.stunFirePenalty;
    p*=exposure??map.geometry.visibleFraction(att.position,tgt.position);
    if(att.aimbuffUntil>=time&&att.aimbuffMult)p*=att.aimbuffMult;
    return Math.max(.01,Math.min(.9,p));
  }
  let chance = gun.accuracy + (att.aim - tgt.aim) * 0.003;
  if (att.holdTicks < 2) chance *= 0.8;
  if (att.moving) chance *= 0.65;
  if (att.stun > 0) chance *= cfg.utility.stunFirePenalty;
  if (entry) chance += 0.1;
  const cover = tgt.post ? tgt.cover ?? 0.3 : 0.1;
  chance *= 1 - cover * 0.25;
  return Math.max(0.05, Math.min(0.9, chance));
}

function damageFor(att, tgt) {
  const gun = weaponSpec(att.gun);
  const armor = tgt.armor === 'heavy' ? 0.72 : tgt.armor === 'light' ? 0.85 : 1;
  return Math.max(1, Math.round(gun.damage * armor));
}

module.exports = { weaponSpec, hitChance, damageFor };
