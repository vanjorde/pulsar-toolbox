export type PollerStatus = "connecting" | "connected" | "error";

export interface AsyncPollerOptions<T> {
  intervalMs: number;
  fetcher: () => Promise<T>;
  onResult: (result: T) => void;
  onError?: (error: unknown) => void;
  onStatusChange?: (status: PollerStatus) => void;
  immediate?: boolean;
}

export class AsyncPoller<T> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private inflight: Promise<void> | null = null;

  constructor(private readonly options: AsyncPollerOptions<T>) {}

  start() {
    if (this.running) {
      return;
    }
    this.running = true;
    if (this.options.immediate === false) {
      this.timer = setTimeout(() => this.execute(), this.options.intervalMs);
    } else {
      void this.execute();
    }
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext() {
    if (!this.running) {
      return;
    }
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.execute(), this.options.intervalMs);
  }

  private async execute() {
    if (!this.running || this.inflight) {
      return;
    }
    this.options.onStatusChange?.("connecting");
    const run = async () => {
      try {
        const result = await this.options.fetcher();
        if (!this.running) {
          return;
        }
        this.options.onStatusChange?.("connected");
        this.options.onResult(result);
      } catch (error) {
        if (!this.running) {
          return;
        }
        this.options.onStatusChange?.("error");
        this.options.onError?.(error);
      } finally {
        this.inflight = null;
        if (this.running) {
          this.scheduleNext();
        }
      }
    };

    this.inflight = run();
    await this.inflight;
  }
}
