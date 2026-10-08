// Coach estimates use sightings and publicly visible plants, never enemy plans.
function estimate(events, observerSide, map) {
  const sightings = events.filter(e => e.type === 'sighting' && e.side === observerSide);
  const targets = new Set(sightings.map(e => e.targetId || e.target));
  if (targets.size < 2) return null;
  const regions = sightings.map(e => map.region(e.node));
  if (observerSide === 'def') {
    const early = new Set(sightings.filter(e => e.t <= 12).map(e => e.targetId || e.target)).size;
    if (early >= 3) return 'rush';
    if (regions.filter(r => r === 'mid').length >= sightings.length / 2) return 'mid';
    const plant = events.find(e => e.type === 'plant');
    const first = sightings[0];
    if (plant && map.region(first.node) !== plant.site && first.t < plant.t - 8) return 'fake';
    if (regions.includes('A') && regions.includes('B')) return 'lurk';
    return 'contact';
  }
  if (sightings.some(e => ['t_spawn', 'a_main', 'b_main'].includes(e.node))) return 'flank';
  if (regions.filter(r => r === 'mid').length >= sightings.length / 2) return 'push';
  const plant = events.find(e => e.type === 'plant');
  if (plant && sightings.filter(e => e.t > plant.t).length >= sightings.length / 2) return 'retake';
  if (new Set(regions).size === 1 && targets.size >= 3) return 'trap';
  return 'hold';
}
module.exports = { estimate };
