import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../../core/stores/auth.store';

@Component({
  selector: 'app-register',
  imports: [RouterLink],
  templateUrl: './register.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  private auth = inject(AuthStore);
  private router = inject(Router);

  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly confirmPassword = signal('');
  readonly error = signal('');
  readonly loading = this.auth.loading;

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set('');

    if (this.password() !== this.confirmPassword()) {
      this.error.set('Passwords do not match');
      return;
    }

    if ((this.password() ?? '').length < 6) {
      this.error.set('Password must be at least 6 characters');
      return;
    }

    const result = await this.auth.register(this.name(), this.email(), this.password());
    if (result.ok) {
      await this.router.navigate(['/']);
    } else {
      this.error.set(result.message ?? 'Registration failed');
    }
  }
}