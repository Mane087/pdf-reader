import { toHighlightedCopyName } from './copy-file-name';

describe('toHighlightedCopyName', () => {
  it('adds the "-highlighted" suffix before the .pdf extension', () => {
    expect(toHighlightedCopyName('clean-code.pdf')).toBe('clean-code-highlighted.pdf');
  });

  it('does not duplicate the suffix when it is already present', () => {
    expect(toHighlightedCopyName('clean-code-highlighted.pdf')).toBe('clean-code-highlighted.pdf');
  });

  it('handles names without a .pdf extension by appending it', () => {
    expect(toHighlightedCopyName('clean-code')).toBe('clean-code-highlighted.pdf');
  });

  it('handles an uppercase .PDF extension', () => {
    expect(toHighlightedCopyName('CLEAN-CODE.PDF')).toBe('CLEAN-CODE-highlighted.pdf');
  });

  it('falls back to a default name when the file name is empty', () => {
    expect(toHighlightedCopyName('')).toBe('documento-highlighted.pdf');
  });

  it('falls back to a default name when the file name is only whitespace', () => {
    expect(toHighlightedCopyName('   ')).toBe('documento-highlighted.pdf');
  });
});
