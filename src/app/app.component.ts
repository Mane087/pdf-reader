import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ThemePreferencesStore } from './core/storage/theme-preferences-store.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  /**
   * Instantiated here so the stored theme is applied to `<html>` on every
   * route, not only while the reader (which owns the toggle) is mounted.
   */
  protected readonly theme = inject(ThemePreferencesStore);
}
