import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { ScoreSlider } from './ScoreSlider';

function EnergySliderHarness() {
  const [value, setValue] = useState<number | null>(null);
  return (
    <ScoreSlider
      id="energy"
      label="Énergie"
      tone="energy"
      value={value}
      onChange={setValue}
    />
  );
}

function mockSliderRect(element: HTMLElement) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 200,
    bottom: 44,
    width: 200,
    height: 44,
    toJSON() {
      return {};
    },
  });
}

describe('ScoreSlider', () => {
  test('affiche — / 10 tant qu’aucune valeur n’est choisie', () => {
    render(<EnergySliderHarness />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText(/\/ 10/)).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Énergie' })).toHaveAttribute(
      'aria-valuetext',
      'non renseigné',
    );
  });

  test('un pointerdown sur la piste met à jour la valeur affichée', () => {
    render(<EnergySliderHarness />);
    const slider = screen.getByRole('slider', { name: 'Énergie' });
    mockSliderRect(slider);

    fireEvent.pointerDown(slider, { clientX: 120 });

    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
    expect(slider).toHaveAttribute('aria-valuetext', '6 sur 10');
  });

  test('un pointerdown à gauche pose 0, à droite pose 10', () => {
    render(<EnergySliderHarness />);
    const slider = screen.getByRole('slider', { name: 'Énergie' });
    mockSliderRect(slider);

    fireEvent.pointerDown(slider, { clientX: 0 });
    expect(screen.getByText('0')).toBeInTheDocument();

    fireEvent.pointerDown(slider, { clientX: 200 });
    expect(screen.getByText('10')).toBeInTheDocument();
  });
});
