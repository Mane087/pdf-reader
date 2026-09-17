export type PageNavigationCommand = 'next' | 'previous' | 'first' | 'last';

export interface KeyboardNavigationContext {
  /** PDF.js moves the selected highlight with the arrow keys, so navigation must yield. */
  hasSelectedEditor: boolean;
  /** Any modal panel (alias settings, confirmations) blocks navigation. */
  isDialogOpen: boolean;
}

export type NavigationKeyboardEvent = Pick<
  KeyboardEvent,
  'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'target'
>;

const KEY_COMMANDS: Record<string, PageNavigationCommand> = {
  ArrowRight: 'next',
  ArrowLeft: 'previous',
  Home: 'first',
  End: 'last',
};

/** Pure decision function used by the reader; returns `null` when the key must be ignored. */
export function resolvePageNavigation(
  event: NavigationKeyboardEvent,
  context: KeyboardNavigationContext,
): PageNavigationCommand | null {
  const command = KEY_COMMANDS[event.key];
  if (!command) {
    return null;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }
  if (context.isDialogOpen || context.hasSelectedEditor) {
    return null;
  }
  if (isEditableTarget(event.target)) {
    return null;
  }
  return command;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }
  if (target.isContentEditable === true) {
    return true;
  }
  // `isContentEditable` is not available in every environment, so fall back to the attribute.
  const contentEditable = target.getAttribute('contenteditable');
  return (
    contentEditable === '' || contentEditable === 'true' || contentEditable === 'plaintext-only'
  );
}
