import {
  KeyboardNavigationContext,
  NavigationKeyboardEvent,
  isEditableTarget,
  resolvePageNavigation,
} from './keyboard-navigation';

function makeEvent(overrides: Partial<NavigationKeyboardEvent> = {}): NavigationKeyboardEvent {
  return {
    key: 'ArrowRight',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    target: null,
    ...overrides,
  };
}

function makeContext(
  overrides: Partial<KeyboardNavigationContext> = {},
): KeyboardNavigationContext {
  return {
    hasSelectedEditor: false,
    isDialogOpen: false,
    ...overrides,
  };
}

describe('resolvePageNavigation', () => {
  it('resolves ArrowRight to "next"', () => {
    expect(resolvePageNavigation(makeEvent({ key: 'ArrowRight' }), makeContext())).toBe('next');
  });

  it('resolves ArrowLeft to "previous"', () => {
    expect(resolvePageNavigation(makeEvent({ key: 'ArrowLeft' }), makeContext())).toBe('previous');
  });

  it('resolves Home to "first"', () => {
    expect(resolvePageNavigation(makeEvent({ key: 'Home' }), makeContext())).toBe('first');
  });

  it('resolves End to "last"', () => {
    expect(resolvePageNavigation(makeEvent({ key: 'End' }), makeContext())).toBe('last');
  });

  it('ignores keys that are not mapped to a navigation command', () => {
    expect(resolvePageNavigation(makeEvent({ key: 'PageDown' }), makeContext())).toBeNull();
  });

  it('ignores the key when ctrlKey is pressed', () => {
    expect(resolvePageNavigation(makeEvent({ ctrlKey: true }), makeContext())).toBeNull();
  });

  it('ignores the key when metaKey is pressed', () => {
    expect(resolvePageNavigation(makeEvent({ metaKey: true }), makeContext())).toBeNull();
  });

  it('ignores the key when altKey is pressed', () => {
    expect(resolvePageNavigation(makeEvent({ altKey: true }), makeContext())).toBeNull();
  });

  it('ignores the key when a highlight editor is selected', () => {
    const context = makeContext({ hasSelectedEditor: true });

    expect(resolvePageNavigation(makeEvent(), context)).toBeNull();
  });

  it('ignores the key when a dialog is open', () => {
    const context = makeContext({ isDialogOpen: true });

    expect(resolvePageNavigation(makeEvent(), context)).toBeNull();
  });

  it('ignores the key when the target is an input element', () => {
    const input = document.createElement('input');

    expect(resolvePageNavigation(makeEvent({ target: input }), makeContext())).toBeNull();
  });

  it('ignores the key when the target is a textarea element', () => {
    const textarea = document.createElement('textarea');

    expect(resolvePageNavigation(makeEvent({ target: textarea }), makeContext())).toBeNull();
  });

  it('ignores the key when the target is a select element', () => {
    const select = document.createElement('select');

    expect(resolvePageNavigation(makeEvent({ target: select }), makeContext())).toBeNull();
  });

  it('ignores the key when the target is a contenteditable element', () => {
    const div = document.createElement('div');
    Object.defineProperty(div, 'isContentEditable', { value: true });

    expect(resolvePageNavigation(makeEvent({ target: div }), makeContext())).toBeNull();
  });
});

describe('isEditableTarget', () => {
  it('returns false for a null target', () => {
    expect(isEditableTarget(null)).toBe(false);
  });

  it('returns false for a plain div', () => {
    expect(isEditableTarget(document.createElement('div'))).toBe(false);
  });

  it('returns true for an input element', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true);
  });

  it('returns true for a contenteditable element', () => {
    const div = document.createElement('div');
    Object.defineProperty(div, 'isContentEditable', { value: true });

    expect(isEditableTarget(div)).toBe(true);
  });
});
