interface SplashHandle {
  finish(): Promise<void>;
  cancel(): void;
}

export function showKagieSplash(label: string): SplashHandle | undefined {
  const host = window as Window & { KagieSplash?: { show(options: { label: string }): SplashHandle } };
  return host.KagieSplash?.show({ label });
}
