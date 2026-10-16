export function createSingleFlight<T>() {
  let inFlightPromise: Promise<T> | null = null;

  return function runSingleFlight(fn: () => Promise<T>): Promise<T> {
    if (inFlightPromise) {
      return inFlightPromise;
    }

    inFlightPromise = fn().finally(() => {
      inFlightPromise = null;
    });

    return inFlightPromise;
  };
}
