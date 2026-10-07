import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../../core/stores/auth.store';

@Component({
  selector: 'app-login',
  imports: [RouterLink],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private auth = inject(AuthStore);
  private router = inject(Router);

  readonly email = signal('');
  readonly password = signal('');
  readonly error = signal('');
  readonly loading = this.auth.loading;

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set('');
    const result = await this.auth.login(this.email(), this.password());
    if (result.ok) {
      await this.router.navigate(['/']);
    } else {
      this.error.set(result.message ?? 'Login failed');
    }
  }
}