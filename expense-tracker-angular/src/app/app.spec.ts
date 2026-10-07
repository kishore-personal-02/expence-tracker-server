import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
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
import { App } from './app';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor])),
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
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders the navbar shell with router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-navbar')).toBeTruthy();
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });
});