import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import type { ThemePreference } from '../../core/models/ui.model';
import { AuthStore } from '../../core/stores/auth.store';
import { ThemeStore } from '../../core/stores/theme.store';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';

interface ThemeOption {
  value: ThemePreference;
  icon: string;
  label: string;
}

const THEMES: ThemeOption[] = [
  { value: 'system', icon: 'phosphorMonitor', label: 'System' },
  { value: 'light', icon: 'phosphorSun', label: 'Light' },
  { value: 'dark', icon: 'phosphorMoon', label: 'Dark' },
];

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive, AvatarComponent, NgIcon],
  templateUrl: './navbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavbarComponent {
  private auth = inject(AuthStore);
  private themeStore = inject(ThemeStore);
  private router = inject(Router);

  private readonly themeMenuEl = viewChild<ElementRef<HTMLElement>>('themeMenu');
  private readonly userMenuEl = viewChild<ElementRef<HTMLElement>>('userMenu');

  readonly user = this.auth.user;
  readonly theme = this.themeStore.preference;
  readonly themeOptions = THEMES;

  readonly themeMenuOpen = signal(false);
  readonly userMenuOpen = signal(false);
  readonly drawerOpen = signal(false);

  readonly currentTheme = computed(
    () => this.themeOptions.find((t) => t.value === this.theme()) ?? this.themeOptions[0]
  );

  constructor() {
    effect((onCleanup) => {
      document.body.style.overflow = this.drawerOpen() ? 'hidden' : '';
      onCleanup(() => {
        document.body.style.overflow = '';
      });
    });
  }

  closeAll(): void {
    this.themeMenuOpen.set(false);
    this.userMenuOpen.set(false);
    this.drawerOpen.set(false);
  }

  toggleThemeMenu(): void {
    this.themeMenuOpen.update((open) => !open);
    this.userMenuOpen.set(false);
  }

  selectTheme(value: ThemePreference): void {
    this.themeStore.setPreference(value);
    this.themeMenuOpen.set(false);
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update((open) => !open);
    this.themeMenuOpen.set(false);
  }

  toggleDrawer(): void {
    this.drawerOpen.update((open) => !open);
  }

  handleLogout(): void {
    this.closeAll();
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentMouseDown(event: MouseEvent): void {
    if (this.themeMenuEl() && !this.themeMenuEl()!.nativeElement.contains(event.target as Node)) {
      this.themeMenuOpen.set(false);
    }
    if (this.userMenuEl() && !this.userMenuEl()!.nativeElement.contains(event.target as Node)) {
      this.userMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onKeydownEscape(): void {
    this.closeAll();
  }
}