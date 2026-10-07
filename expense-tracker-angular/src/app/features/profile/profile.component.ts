import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  phosphorDeviceMobile,
  phosphorFolder,
  phosphorHourglass,
  phosphorLockKey,
  phosphorLockSimple,
  phosphorMoon,
  phosphorMonitor,
  phosphorPalette,
  phosphorReceipt,
  phosphorSun,
  phosphorTag,
  phosphorTrendDown,
  phosphorTrophy,
  phosphorWarning,
} from '@ng-icons/phosphor-icons/regular';
import { lastValueFrom } from 'rxjs';
import { AuthApi } from '../../core/api/auth-api.service';
import type { ThemePreference } from '../../core/models/ui.model';
import type { UserProfile } from '../../core/models/auth.model';
import { AuthStore } from '../../core/stores/auth.store';
import { PreferencesStore } from '../../core/stores/preferences.store';
import { ThemeStore } from '../../core/stores/theme.store';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { extractApiError } from '../../core/utils/http-error';
import { formatCurrency, formatJoinDate } from '../../core/utils/formatters';

interface ProfileStat {
  key: 'totalExpenses' | 'totalSpent' | 'topCategory';
  label: string;
  icon: string;
}

interface ThemeOption {
  value: ThemePreference;
  icon: string;
  label: string;
  desc: string;
}

interface Notice {
  type: 'error' | 'success';
  text: string;
}

const STATS: ProfileStat[] = [
  { key: 'totalExpenses', label: 'Total Expenses', icon: 'phosphorReceipt' },
  { key: 'totalSpent', label: 'Total Spent', icon: 'phosphorTrendDown' },
  { key: 'topCategory', label: 'Top Category', icon: 'phosphorTrophy' },
];

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'system', icon: 'phosphorMonitor', label: 'System', desc: 'Follow device' },
  { value: 'light', icon: 'phosphorSun', label: 'Light', desc: 'Light theme' },
  { value: 'dark', icon: 'phosphorMoon', label: 'Dark', desc: 'Dark theme' },
];

@Component({
  selector: 'app-profile',
  imports: [AvatarComponent, NgIcon],
  templateUrl: './profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    provideIcons({
      phosphorDeviceMobile,
      phosphorFolder,
      phosphorHourglass,
      phosphorLockKey,
      phosphorLockSimple,
      phosphorMoon,
      phosphorMonitor,
      phosphorPalette,
      phosphorReceipt,
      phosphorSun,
      phosphorTag,
      phosphorTrendDown,
      phosphorTrophy,
      phosphorWarning,
    }),
  ],
})
export class ProfileComponent implements OnDestroy {
  private readonly authApi = inject(AuthApi);
  readonly auth = inject(AuthStore);
  private readonly themeStore = inject(ThemeStore);
  private readonly preferences = inject(PreferencesStore);
  private readonly router = inject(Router);

  readonly formatCurrency = formatCurrency;

  readonly profile = signal<UserProfile | null>(null);
  readonly loading = signal(true);
  readonly message = signal<Notice | null>(null);

  readonly name = signal(this.auth.user()?.name ?? '');
  readonly savingName = signal(false);

  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly savingPassword = signal(false);

  readonly newCategory = signal('');
  readonly newUpiApp = signal('');
  readonly addingCategory = signal(false);
  readonly addingUpiApp = signal(false);

  readonly confirmDelete = signal('');
  readonly deleting = signal(false);

  readonly user = this.auth.user;
  readonly theme = this.themeStore.preference;
  readonly themeOptions = THEME_OPTIONS;
  readonly statsConfig = STATS;

  readonly categories = computed(() => this.preferences.prefs().categories);
  readonly upiApps = computed(() => this.preferences.prefs().upiApps);
  readonly customCategories = computed(() => this.preferences.prefs().customCategories);
  readonly customUpiApps = computed(() => this.preferences.prefs().customUpiApps);

  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.authApi.profile().subscribe({
      next: (data) => this.profile.set(data),
      error: () => this.showMessage('error', 'Failed to load profile'),
    });
    effect(() => {
      const authUser = this.auth.user();
      if (authUser) this.name.set(authUser.name);
    });
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  showMessage(type: Notice['type'], text: string): void {
    this.message.set({ type, text });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.message.set(null), 4000);
  }

  statValue(key: ProfileStat['key']): string {
    const stats = this.profile()?.stats;
    const raw = stats ? (stats[key] as string | number | null | undefined) : undefined;
    if (key === 'totalSpent') return this.formatCurrency(Number(raw ?? 0));
    if (key === 'topCategory') return raw ? String(raw) : '—';
    return String(raw ?? 0);
  }

  formatJoinDate = formatJoinDate;

  async onNameSubmit(event: Event): Promise<void> {
    event.preventDefault();
    const clean = this.name().trim();
    if (!clean) return;
    this.savingName.set(true);
    try {
      const data = await lastValueFrom(this.authApi.updateName(clean));
      if (data) {
        this.auth.updateUser({ name: data.name });
        this.profile.update((prev) => (prev ? { ...prev, name: data.name } : prev));
      }
      this.showMessage('success', 'Name updated');
    } catch (err) {
      this.showMessage('error', extractApiError(err, 'Failed to update name'));
    } finally {
      this.savingName.set(false);
    }
  }

  async onPasswordSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.message.set(null);
    if (this.newPassword() !== this.confirmPassword()) {
      this.showMessage('error', 'New passwords do not match');
      return;
    }
    this.savingPassword.set(true);
    try {
      await lastValueFrom(
        this.authApi.updatePassword(this.currentPassword(), this.newPassword())
      );
      this.currentPassword.set('');
      this.newPassword.set('');
      this.confirmPassword.set('');
      this.showMessage('success', 'Password changed successfully');
    } catch (err) {
      this.showMessage('error', extractApiError(err, 'Failed to change password'));
    } finally {
      this.savingPassword.set(false);
    }
  }

  async onDeleteAccount(): Promise<void> {
    if (this.confirmDelete().toLowerCase() !== 'delete') {
      this.showMessage('error', 'Type "delete" to confirm');
      return;
    }
    if (!window.confirm('This will permanently delete your account and ALL expenses. Continue?')) {
      return;
    }
    this.deleting.set(true);
    try {
      await lastValueFrom(this.authApi.deleteAccount());
      this.auth.logout();
      void this.router.navigate(['/register']);
    } catch (err) {
      this.showMessage('error', extractApiError(err, 'Failed to delete account'));
      this.deleting.set(false);
    }
  }

  async onAddCategorySubmit(event: Event): Promise<void> {
    event.preventDefault();
    const clean = this.newCategory().trim();
    if (!clean) return;
    if (this.categories().some((c) => c.toLowerCase() === clean.toLowerCase())) {
      this.showMessage('error', `Category "${clean}" already exists`);
      return;
    }
    this.addingCategory.set(true);
    try {
      await this.preferences.addCategory(clean);
      this.newCategory.set('');
      this.showMessage('success', `Added category "${clean}"`);
    } catch (err) {
      this.showMessage('error', extractApiError(err, 'Failed to add category'));
    } finally {
      this.addingCategory.set(false);
    }
  }

  async onAddUpiAppSubmit(event: Event): Promise<void> {
    event.preventDefault();
    const clean = this.newUpiApp().trim();
    if (!clean) return;
    if (this.upiApps().some((a) => a.toLowerCase() === clean.toLowerCase())) {
      this.showMessage('error', `UPI app "${clean}" already exists`);
      return;
    }
    this.addingUpiApp.set(true);
    try {
      await this.preferences.addUpiApp(clean);
      this.newUpiApp.set('');
      this.showMessage('success', `Added UPI app "${clean}"`);
    } catch (err) {
      this.showMessage('error', extractApiError(err, 'Failed to add UPI app'));
    } finally {
      this.addingUpiApp.set(false);
    }
  }

  async onRemoveCategory(cat: string): Promise<void> {
    try {
      await this.preferences.removeCategory(cat);
      this.showMessage('success', `Removed "${cat}"`);
    } catch (err) {
      this.showMessage('error', extractApiError(err, 'Failed to remove category'));
    }
  }

  async onRemoveUpiApp(app: string): Promise<void> {
    try {
      await this.preferences.removeUpiApp(app);
      this.showMessage('success', `Removed "${app}"`);
    } catch (err) {
      this.showMessage('error', extractApiError(err, 'Failed to remove UPI app'));
    }
  }

  selectTheme(pref: ThemePreference): void {
    this.themeStore.setPreference(pref);
  }
}