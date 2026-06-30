class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  public get length(): number {
    return this.store.size;
  }

  public clear(): void {
    this.store.clear();
  }

  public getItem(key: string): string | null {
    return this.store.get(String(key)) ?? null;
  }

  public key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  public removeItem(key: string): void {
    this.store.delete(String(key));
  }

  public setItem(key: string, value: string): void {
    this.store.set(String(key), String(value));
  }
}

const installMemoryStorage = (): void => {
  const StorageConstructor = MemoryStorage as unknown as typeof Storage;
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();

  Object.defineProperty(globalThis, 'Storage', {
    configurable: true,
    value: StorageConstructor,
  });

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: localStorage,
  });

  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: sessionStorage,
  });

  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'Storage', {
      configurable: true,
      value: StorageConstructor,
    });
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorage,
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: sessionStorage,
    });
  }
};

installMemoryStorage();
