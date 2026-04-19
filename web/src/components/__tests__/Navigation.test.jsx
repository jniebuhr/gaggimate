import { render } from '@testing-library/preact';
import { Navigation } from '../Navigation.jsx';

describe('Navigation', () => {
  it('renders expanded navigation items', () => {
    const { container } = render(<Navigation collapsed={false} onToggleCollapsed={() => {}} />);
    expect(container.querySelector('nav')).toBeTruthy();
    expect(container.querySelectorAll('a').length).toBeGreaterThan(0);
  });

  it('renders collapsed navigation with icons only', () => {
    const { container } = render(<Navigation collapsed={true} onToggleCollapsed={() => {}} />);
    const nav = container.querySelector('nav');
    expect(nav).toBeTruthy();
  });

  it('calls onToggleCollapsed when toggle button is clicked', () => {
    const mockToggle = jest.fn();
    const { container } = render(<Navigation collapsed={false} onToggleCollapsed={mockToggle} />);
    const button = container.querySelector('button');
    button.click();
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });
});