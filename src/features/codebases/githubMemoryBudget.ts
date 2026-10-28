export const MAX_GITHUB_MEMORY_BYTES = 128 * 1024 * 1024;
const MAX_ACTIVE_RESPONSES = 8;
const MAX_WAITERS = 64;
const MAX_WAIT_MS = 15_000;

type Release = () => void;

interface Waiter {
  amount: number;
  resolve: (release: Release) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

class CapacityGate {
  private readonly waiting: Waiter[] = [];
  private used = 0;

  constructor(private readonly capacity: number) {}

  reserve(amount: number): Promise<Release> {
    if (this.invalid(amount) || this.waiting.length >= MAX_WAITERS) return Promise.reject(new GithubBusyError());
    if (this.waiting.length === 0 && this.fits(amount)) return Promise.resolve(this.take(amount));
    return this.wait(amount);
  }

  private invalid(amount: number): boolean {
    return !Number.isSafeInteger(amount) || amount <= 0 || amount > this.capacity;
  }

  private fits(amount: number): boolean {
    return this.used + amount <= this.capacity;
  }

  private take(amount: number): Release {
    this.used += amount;
    let held = true;
    return () => {
      if (!held) return;
      held = false;
      this.release(amount);
    };
  }

  private wait(amount: number): Promise<Release> {
    return new Promise((resolve, reject) => {
      const waiter = { amount, resolve, reject, timer: setTimeout(() => this.expire(waiter), MAX_WAIT_MS) };
      this.waiting.push(waiter);
    });
  }

  private expire(waiter: Waiter): void {
    const index = this.waiting.indexOf(waiter);
    if (index === -1) return;
    this.waiting.splice(index, 1);
    waiter.reject(new GithubBusyError());
    this.drain();
  }

  private release(amount: number): void {
    this.used -= amount;
    this.drain();
  }

  private drain(): void {
    while (this.waiting[0] && this.fits(this.waiting[0].amount)) this.admitFirst();
  }

  private admitFirst(): void {
    const waiter = this.waiting.shift() as Waiter;
    clearTimeout(waiter.timer);
    waiter.resolve(this.take(waiter.amount));
  }
}

const memory = new CapacityGate(MAX_GITHUB_MEMORY_BYTES);
const responses = new CapacityGate(MAX_ACTIVE_RESPONSES);

export async function withGithubMemoryBudget<T>(bytes: number, work: () => Promise<T>): Promise<T> {
  const release = await memory.reserve(bytes);
  try {
    return await work();
  } finally {
    release();
  }
}

export function holdGithubResponseSlot(): Promise<Release> {
  return responses.reserve(1);
}

class GithubBusyError extends Error {
  readonly status = 429;

  constructor() {
    super('The server is busy processing GitHub data; try again shortly');
  }
}
