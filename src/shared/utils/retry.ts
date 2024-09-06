export function wait_for(ms: number = 5000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function exponentialRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  initialDelay = 100,
): Promise<T | undefined> {
  let retryCount = 0;
  const maxDelay = Math.pow(2, maxRetries) * initialDelay;

  while (retryCount <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      if (retryCount === maxRetries) {
        throw error; // Throw the error if max retries is reached
      }

      const delay = Math.min(initialDelay * Math.pow(2, retryCount), maxDelay);
      console.log(`Retrying after ${delay}ms...`);
      await wait_for(delay);
      retryCount++;
    }
  }
}
