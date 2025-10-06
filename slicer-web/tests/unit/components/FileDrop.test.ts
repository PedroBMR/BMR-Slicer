import { createElement } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FileDrop } from '../../../components/FileDrop';
import {
  FILE_TOO_LARGE_ERROR,
  MAX_FILE_SIZE_BYTES,
  type ViewerStore,
  useViewerStore,
} from '../../../modules/store';

describe('FileDrop', () => {
  const originalLoadFile = useViewerStore.getState().loadFile;
  const originalSetState = useViewerStore.setState;
  const loadFileMock = vi
    .fn<Parameters<ViewerStore['loadFile']>, ReturnType<ViewerStore['loadFile']>>()
    .mockResolvedValue(undefined);

  beforeAll(() => {
    useViewerStore.setState = ((...args) => {
      act(() => {
        originalSetState(...args);
      });
    }) as typeof useViewerStore.setState;
  });

  beforeEach(() => {
    loadFileMock.mockClear();
    useViewerStore.setState({
      loadFile: loadFileMock,
      error: undefined,
      loading: false,
    });
  });

  afterAll(() => {
    useViewerStore.setState = originalSetState;
  });

  afterEach(() => {
    useViewerStore.setState({
      loadFile: originalLoadFile,
      error: undefined,
      loading: false,
    });
  });

  it('surfaces an error and resets the input when the file is too large', async () => {
    const user = userEvent.setup();
    render(createElement(FileDrop));

    const input = screen.getByLabelText(/choose file/i) as HTMLInputElement;
    const file = new File(['dummy'], 'large.stl', { type: 'model/stl' });
    Object.defineProperty(file, 'size', {
      get: () => MAX_FILE_SIZE_BYTES + 1,
    });

    await act(async () => {
      await user.upload(input, file);
    });

    expect(screen.getByText(FILE_TOO_LARGE_ERROR)).toBeInTheDocument();

    expect(useViewerStore.getState().error).toBe(FILE_TOO_LARGE_ERROR);
    expect(useViewerStore.getState().loading).toBe(false);
    expect(loadFileMock).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });
});
