import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useAppearance } from './use-appearance';

afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); document.documentElement.className = ''; });
it('defaults to dark, persists an explicit choice and follows system changes only in system mode', async () => {
  let dark = false;
  let changed = () => {};
  const remove = vi.fn();
  vi.stubGlobal('matchMedia', () => ({ get matches() { return dark; }, addEventListener: (_: string, handler: () => void) => { changed = handler; }, removeEventListener: remove }));
  const view = renderHook(useAppearance);
  expect(view.result.current.mode).toBe('dark');
  expect(document.documentElement).toHaveClass('dark');
  act(() => view.result.current.choose('system'));
  await waitFor(() => expect(view.result.current.mode).toBe('light'));
  expect(localStorage.getItem('kloda.appearance')).toBe('system');
  act(() => { dark = true; changed(); });
  expect(view.result.current.mode).toBe('dark');
  act(() => view.result.current.choose('light'));
  act(() => { dark = false; changed(); });
  expect(document.documentElement).toHaveClass('light');
  view.unmount();
  expect(remove).toHaveBeenCalledOnce();
});
it('ignores an invalid saved preference and stays usable if preference persistence is unavailable', () => {
  localStorage.setItem('kloda.appearance', 'invalid');
  const view = renderHook(useAppearance);
  expect(view.result.current.preference).toBe('dark');
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('fixture unavailable'); });
  act(() => view.result.current.choose('light'));
  expect(view.result.current.mode).toBe('light');
  write.mockRestore();
});
