import { CanDeactivateFn } from '@angular/router';

export const UNSAVED_CHANGES_MESSAGE = 'Hay cambios sin guardar. ¿Deseas salir sin guardarlos?';

export interface UnsavedChangesAware {
  hasUnsavedChanges(): boolean;
}

export const unsavedChangesGuard: CanDeactivateFn<UnsavedChangesAware> = (component) => {
  if (!component.hasUnsavedChanges()) {
    return true;
  }
  return window.confirm(UNSAVED_CHANGES_MESSAGE);
};
