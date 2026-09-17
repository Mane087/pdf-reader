import { Routes } from '@angular/router';

import { unsavedChangesGuard } from './features/reader/unsaved-changes.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/library/library.component').then((m) => m.LibraryComponent),
  },
  {
    path: 'reader/:documentId',
    loadComponent: () =>
      import('./features/reader/reader.component').then((m) => m.ReaderComponent),
    canDeactivate: [unsavedChangesGuard],
  },
  { path: '**', redirectTo: '' },
];
