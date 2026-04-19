import { render } from '@testing-library/preact';
import { App } from '../index.jsx';

describe('App', () => {
  it('reads collapsed state from localStorage', () => {
    // Mock localStorage
    const mockStorage = { getItem: jest.fn(() => 'true'), setItem: jest.fn() };
    globalThis.window = { localStorage: mockStorage };

    render(<App />);

    expect(mockStorage.getItem).toHaveBeenCalledWith('gaggimate.desktopNavCollapsed');
  });
});