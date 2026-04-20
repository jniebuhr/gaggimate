import { render, act } from '@testing-library/preact';
import { Navigation } from '../Navigation.jsx';

// Mock localStorage
const mockStorage = (() => {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] ?? null),
    setItem: jest.fn((key, value) => { store[key] = String(value); }),
    clear: () => { store = {}; jest.clearAllMocks(); },
  };
})();

Object.defineProperty(window, 'localStorage', { value: mockStorage });

beforeEach(() => mockStorage.clear());

describe('Navigation', () => {
  it('renders navigation with links', () => {
    const { container } = render(<Navigation />);
    expect(container.querySelector('nav')).toBeTruthy();
    expect(container.querySelectorAll('a').length).toBeGreaterThan(0);
  });

  it('starts collapsed by default when no localStorage value exists', () => {
    const { container } = render(<Navigation />);
    const inner = container.querySelector('nav > div');
    expect(inner.className).toMatch(/w-14/);
  });

  it('reads initial collapsed state from localStorage', () => {
    mockStorage.getItem.mockReturnValueOnce('false');
    const { container } = render(<Navigation />);
    const inner = container.querySelector('nav > div');
    expect(inner.className).toMatch(/w-\[14rem\]/);
  });

  it('persists collapsed state to localStorage on change', async () => {
    const { container } = render(<Navigation />);
    const nav = container.querySelector('nav');

    await act(async () => nav.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })));
    expect(mockStorage.setItem).toHaveBeenCalledWith('gaggimate.desktopNavCollapsed', 'false');

    await act(async () => nav.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true })));
    expect(mockStorage.setItem).toHaveBeenCalledWith('gaggimate.desktopNavCollapsed', 'true');
  });

  it('calls onCollapsedChange when collapse state changes', async () => {
    const onCollapsedChange = jest.fn();
    const { container } = render(<Navigation onCollapsedChange={onCollapsedChange} />);
    const nav = container.querySelector('nav');

    await act(async () => nav.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })));
    expect(onCollapsedChange).toHaveBeenCalledWith(false);

    await act(async () => nav.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true })));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
  });
});
