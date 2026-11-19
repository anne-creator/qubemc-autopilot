/** Infer separate wheel gestures from a full deceleration/reacceleration trend.
 * No animation/media promises participate in input admission.
 */
export class WheelGesture {
  lastTime = -Infinity;
  lastDelta = 0;
  acceptedAt = -Infinity;
  consumed = false;
  sum = 0;
  peak = 0;
  falling = 0;
  trough = Infinity;
  rising = 0;

  feed(delta, time, lineMode = false) {
    const magnitude = Math.abs(delta);
    if (!Number.isFinite(delta) || magnitude < 0.5) return 0;
    const gap = time - this.lastTime;
    const previous = Math.abs(this.lastDelta);
    const reversed = delta * this.lastDelta < 0 && magnitude >= 8;
    const wheelTick =
      gap >= 65 &&
      (lineMode ||
        (Number.isInteger(delta) && magnitude >= 40 && magnitude === previous));

    // Arm only after sustained decay, so the acceleration of the original flick
    // cannot count as another gesture. Keep the valley across a gradual restart.
    if (this.consumed && gap < 90 && !reversed) {
      this.peak = Math.max(this.peak, magnitude);
      if (magnitude < previous) {
        this.falling++;
        this.rising = 0;
      } else if (magnitude > previous) {
        this.falling = 0;
        this.rising++;
      }
      if (this.falling >= 3 && magnitude <= this.peak * 0.65)
        this.trough = Math.min(this.trough, magnitude);
    }
    // Two rising samples reject isolated momentum spikes. This also recognizes
    // Anne's recorded 2→14→31 restart, which the old <=12 / >=18 pair rule missed.
    const renewed =
      this.rising >= 2 &&
      magnitude >= Math.max(12, this.trough + 6, this.trough * 1.5);
    const fresh = gap >= 90 || reversed || renewed || wheelTick;
    this.lastTime = time;
    this.lastDelta = delta;
    if (this.consumed) {
      if (!fresh || time - this.acceptedAt < 80) return 0;
      this.consumed = false;
      this.sum = 0;
    }
    if (gap >= 90 || Math.sign(this.sum) !== Math.sign(delta)) this.sum = 0;
    this.sum += delta;
    if (Math.abs(this.sum) < 12) return 0;
    this.consumed = true;
    this.acceptedAt = time;
    this.peak = magnitude;
    this.falling = this.rising = 0;
    this.trough = Infinity;
    return Math.sign(this.sum);
  }
}
