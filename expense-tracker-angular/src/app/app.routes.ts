import type { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

// Feature pages are lazy-loaded so chart.js + the chart components ship
// in the dashboard chunk rather than the initial bundle (keeps the main
// chunk within the configured 500 kB warning budget).
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/auth/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: '',
    loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [authGuard],
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/profile/profile.component').then((m) => m.ProfileComponent),
    canActivate: [authGuard],
  },
  {
    path: 'import',
    loadComponent: () => import('./features/import/import.component').then((m) => m.ImportComponent),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: '' },
];