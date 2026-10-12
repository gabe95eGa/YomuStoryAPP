import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { StorySentence } from './StorySentence';

describe('sentence selection', () => {
  it('selects blank space and keyboard input without intercepting word or translation actions', async () => {
    const user = userEvent.setup(), select = vi.fn(), token = vi.fn();
    render(<StorySentence sentence={{ id:'s1', text:'朝。', translation_es:'Por la mañana.', tokens:[{surface:'朝',lemma:'朝',reading:'アサ'}] }}
      number={1} active={false} furigana="all" onSelect={select} onToken={token} />);
    const region = screen.getByRole('region', {name:'Frase 1'});
    await user.click(region); expect(select).toHaveBeenCalledTimes(1);
    region.focus(); await user.keyboard('{Enter} '); expect(select).toHaveBeenCalledTimes(3);
    await user.click(screen.getByRole('button',{name:'Ver palabra: 朝'}));
    expect(token).toHaveBeenCalledTimes(1); expect(select).toHaveBeenCalledTimes(3);
    await user.click(screen.getByRole('button',{name:'Mostrar traducción de la frase 1'}));
    expect(select).toHaveBeenCalledTimes(4); expect(screen.getByText('Por la mañana.')).toBeVisible();
  });
});
