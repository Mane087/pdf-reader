import { readJsonFromLocalStorage, writeJsonToLocalStorage } from './local-storage.util';

describe('readJsonFromLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when the key is missing', () => {
    expect(readJsonFromLocalStorage('missing-key')).toBeNull();
  });

  it('returns null when the stored value is not valid JSON', () => {
    localStorage.setItem('broken-key', '{not json');

    expect(readJsonFromLocalStorage('broken-key')).toBeNull();
  });

  it('parses a valid JSON value', () => {
    localStorage.setItem('valid-key', JSON.stringify({ a: 1, b: 'two' }));

    expect(readJsonFromLocalStorage('valid-key')).toEqual({ a: 1, b: 'two' });
  });
});

describe('writeJsonToLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('stores the value serialized as JSON', () => {
    writeJsonToLocalStorage('some-key', { a: 1 });

    expect(localStorage.getItem('some-key')).toBe(JSON.stringify({ a: 1 }));
  });

  it('skips the write when the stored value is already identical', () => {
    localStorage.setItem('some-key', JSON.stringify({ a: 1 }));
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

    writeJsonToLocalStorage('some-key', { a: 1 });

    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('writes when the stored value differs from the new one', () => {
    localStorage.setItem('some-key', JSON.stringify({ a: 1 }));
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

    writeJsonToLocalStorage('some-key', { a: 2 });

    expect(setItemSpy).toHaveBeenCalledWith('some-key', JSON.stringify({ a: 2 }));
  });

  it('does not throw when localStorage.setItem throws', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(() => writeJsonToLocalStorage('some-key', { a: 1 })).not.toThrow();
  });
});
