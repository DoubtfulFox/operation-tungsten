export type Handler<T> = (payload: T) => void;

/** Minimal typed event bus used for cross-system signals (noise, alarms, objectives). */
export class Emitter<EventMap extends Record<string, unknown>> {
  private handlers = new Map<keyof EventMap, Set<Handler<never>>>();

  on<K extends keyof EventMap>(type: K, fn: Handler<EventMap[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(fn as Handler<never>);
    return () => set!.delete(fn as Handler<never>);
  }

  emit<K extends keyof EventMap>(type: K, payload: EventMap[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const fn of set) (fn as Handler<EventMap[K]>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}
