/** Two #RRGGBB colours mixed, `amount` of the second: the drawing's own way of tinting. */
export function mix(from: string, to: string, amount: number): string {
  const channel = (hex: string, at: number): number => parseInt(hex.slice(1 + at * 2, 3 + at * 2), 16);
  const mixed = [0, 1, 2].map((at) =>
    Math.round(channel(from, at) + (channel(to, at) - channel(from, at)) * amount)
      .toString(16)
      .padStart(2, '0'),
  );

  return `#${mixed.join('')}`;
}
