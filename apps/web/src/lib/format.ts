/** Lamports as SOL text, without trailing zeros. 5000 -> "0.000005". */
export function formatSol(lamports: number): string {
  const whole = Math.floor(lamports / 1e9);
  const frac = String(lamports % 1e9).padStart(9, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : String(whole);
}
