/** Race an RPC call against a timeout — prevents hung UI on flaky testnet. */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'RPC call',
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    }),
  ])
}
