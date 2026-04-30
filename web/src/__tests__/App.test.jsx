import { render, screen } from '@testing-library/preact';
import { App } from '../index.jsx';

describe('App', () => {
  it('renders the navigation entry point in the header', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: /open navigation menu/i })).toBeTruthy();
  });
});
