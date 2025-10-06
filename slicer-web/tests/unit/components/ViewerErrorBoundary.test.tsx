import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ViewerPage from '../../../app/viewer/page';
import { useViewerStore } from '../../../modules/store';

let shouldThrow = false;

vi.mock('../../../components/ModelViewer', async () => {
  const React = await import('react');

  const MockModelViewer = () => {
    if (shouldThrow) {
      shouldThrow = false;
      throw new Error('Mock viewer failure');
    }

    return React.createElement('div', { 'data-testid': 'mock-viewer' }, 'Mock Viewer Ready');
  };

  return { ModelViewer: MockModelViewer };
});

describe('ViewerErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true;
    useViewerStore.setState({
      geometry: { mock: true } as never,
      layers: [{ id: 'layer-1' } as never],
    });
  });

  afterEach(() => {
    useViewerStore.getState().reset();
  });

  it('renders the mocked ModelViewer after recovering from an error', async () => {
    render(<ViewerPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('Mock viewer failure');

    const resetButton = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(resetButton);

    expect(useViewerStore.getState().geometry).toBeUndefined();
    expect(useViewerStore.getState().layers).toEqual([]);

    expect(await screen.findByTestId('mock-viewer')).toBeInTheDocument();
  });
});
