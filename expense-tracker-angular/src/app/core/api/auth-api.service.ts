import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  AuthUser,
  LoginCredentials,
  MessageResponse,
  RegisterPayload,
  UserProfile,
} from '../models/auth.model';
import { API_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private http = inject(HttpClient);

  login(credentials: LoginCredentials): Observable<AuthUser> {
    return this.http.post<AuthUser>(`${API_URL}/auth/login`, credentials);
  }

  register(payload: RegisterPayload): Observable<AuthUser> {
    return this.http.post<AuthUser>(`${API_URL}/auth/register`, payload);
  }

  profile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${API_URL}/auth/profile`);
  }

  updateName(name: string): Observable<Pick<AuthUser, '_id' | 'name' | 'email'>> {
    return this.http.put<Pick<AuthUser, '_id' | 'name' | 'email'>>(`${API_URL}/auth/profile`, { name });
  }

  updatePassword(currentPassword: string, newPassword: string): Observable<MessageResponse> {
    return this.http.put<MessageResponse>(`${API_URL}/auth/password`, {
      currentPassword,
      newPassword,
    });
  }

  deleteAccount(): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${API_URL}/auth/account`);
  }
}