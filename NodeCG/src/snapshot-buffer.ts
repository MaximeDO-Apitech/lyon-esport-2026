export class SnapshotBuffer<T> {
  private delayMs = 0;
  private generation = 0;
  private timers = new Set<NodeJS.Timeout>();
  private readonly maxPending: number;
  private readonly publish: (value: T) => void;

  constructor(publish: (value: T) => void, maxPending = 300) {
    this.publish = publish;
    this.maxPending = maxPending;
  }

  get depth(): number {
    return this.timers.size;
  }

  setDelay(delayMs: number): void {
    const bounded = Math.max(0, Math.min(15_000, Math.round(delayMs)));
    if (bounded === this.delayMs) return;
    this.delayMs = bounded;
    this.clear();
  }

  enqueue(value: T): boolean {
    if (this.timers.size >= this.maxPending) return false;
    if (this.delayMs === 0) {
      this.publish(value);
      return true;
    }

    const generation = this.generation;
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (generation === this.generation) this.publish(value);
    }, this.delayMs);
    this.timers.add(timer);
    return true;
  }

  clear(): void {
    this.generation += 1;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }
}
