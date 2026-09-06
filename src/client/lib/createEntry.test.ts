import { describe, expect, test } from 'vitest';
import { buildCreateEntryBody } from './createEntry';

describe('buildCreateEntryBody', () => {
  test('n’envoie que énergie et fatigue lorsqu’ils sont seuls renseignés', () => {
    expect(
      buildCreateEntryBody({
        energy: 6,
        fatigue: 4,
        desire: null,
        context: '   ',
        activity: null,
      }),
    ).toEqual({ energy: 6, fatigue: 4 });
  });

  test('inclut les champs facultatifs réellement renseignés', () => {
    expect(
      buildCreateEntryBody({
        energy: 7,
        fatigue: 2,
        desire: 5,
        context: '  après une marche  ',
        activity: 'leisure',
      }),
    ).toEqual({
      energy: 7,
      fatigue: 2,
      desire: 5,
      context: 'après une marche',
      activity: 'leisure',
    });
  });
});
