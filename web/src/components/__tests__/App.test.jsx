import { render } from '@testing-library/preact';
import { App } from '../index.jsx';

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

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = render(<App />);
    expect(container.querySelector('#main-content')).toBeTruthy();
  });

  it('reads collapsed nav state from localStorage on mount', () => {
    render(<App />);
    expect(mockStorage.getItem).toHaveBeenCalledWith('gaggimate.desktopNavCollapsed');
  });

  it('grid column reflects collapsed nav state', () => {
    mockStorage.getItem.mockReturnValueOnce('false');
    const { container } = render(<App />);
    const grid = container.querySelector('.grid');
    // When nav is expanded, grid should use the wider column
    expect(grid.className).toMatch(/14rem/);
  });
});
