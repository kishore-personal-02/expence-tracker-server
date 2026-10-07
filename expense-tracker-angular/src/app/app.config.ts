import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import {
  phosphorCaretDown,
  phosphorChartBar,
  phosphorCheck,
  phosphorFileArrowUp,
  phosphorGear,
  phosphorKey,
  phosphorMoon,
  phosphorMonitor,
  phosphorSignOut,
  phosphorSparkle,
  phosphorSun,
  phosphorUser,
  phosphorX,
} from '@ng-icons/phosphor-icons/regular';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
    // App-shell icons only. Feature icons are registered inside their own
    // lazy components so they never inflate the initial bundle.
    provideIcons({
      phosphorCaretDown,
      phosphorChartBar,
      phosphorCheck,
      phosphorFileArrowUp,
      phosphorGear,
      phosphorKey,
      phosphorMoon,
      phosphorMonitor,
      phosphorSignOut,
      phosphorSparkle,
      phosphorSun,
      phosphorUser,
      phosphorX,
    }),
  ],
};