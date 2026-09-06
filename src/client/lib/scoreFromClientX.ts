export function scoreFromClientX(
  clientX: number,
  rect: Pick<DOMRect, 'left' | 'width'>,
): number {
  if (rect.width <= 0) {
    return 0;
  }

  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  return Math.round(ratio * 10);
}
