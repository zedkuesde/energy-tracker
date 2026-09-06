import { describe, expect, test } from 'vitest';
import { scoreFromClientX } from './scoreFromClientX';

const rect = { left: 40, width: 200 };

describe('scoreFromClientX', () => {
  test('tap à gauche de la piste → 0', () => {
    expect(scoreFromClientX(40, rect)).toBe(0);
    expect(scoreFromClientX(0, rect)).toBe(0);
  });

  test('tap à droite de la piste → 10', () => {
    expect(scoreFromClientX(240, rect)).toBe(10);
    expect(scoreFromClientX(400, rect)).toBe(10);
  });

  test('tap vers le milieu → valeur proche de 5', () => {
    expect(scoreFromClientX(140, rect)).toBe(5);
  });
});
