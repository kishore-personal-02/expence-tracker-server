import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Preferences } from '../models/preferences.model';
import { API_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class PreferencesApi {
  private http = inject(HttpClient);

  get(): Observable<Preferences> {
    return this.http.get<Preferences>(`${API_URL}/auth/preferences`);
  }

  addCategory(name: string): Observable<Preferences> {
    return this.http.post<Preferences>(`${API_URL}/auth/preferences/categories`, { name });
  }

  removeCategory(name: string): Observable<Preferences> {
    return this.http.delete<Preferences>(
      `${API_URL}/auth/preferences/categories/${encodeURIComponent(name)}`
    );
  }

  addUpiApp(name: string): Observable<Preferences> {
    return this.http.post<Preferences>(`${API_URL}/auth/preferences/upi-apps`, { name });
  }

  removeUpiApp(name: string): Observable<Preferences> {
    return this.http.delete<Preferences>(
      `${API_URL}/auth/preferences/upi-apps/${encodeURIComponent(name)}`
    );
  }
}