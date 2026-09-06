import { describe, expect, test } from 'vitest';
import { getActivityLabel } from './activities';

describe('getActivityLabel', () => {
  test('retourne les libellés français', () => {
    expect(getActivityLabel('rest')).toBe('Repos');
    expect(getActivityLabel('work')).toBe('Travail');
    expect(getActivityLabel('transport')).toBe('Transport');
    expect(getActivityLabel('leisure')).toBe('Loisir');
    expect(getActivityLabel('creative')).toBe('Activité créative');
    expect(getActivityLabel('sport')).toBe('Sport');
    expect(getActivityLabel('other')).toBe('Autre');
  });
});
