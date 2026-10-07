import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { ImportPayload, ImportResponse, ParseResponse } from '../models/import.model';
import { API_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class ImportApi {
  private http = inject(HttpClient);

  parse(file: File): Observable<ParseResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ParseResponse>(`${API_URL}/import/parse`, formData);
  }

  import(payload: ImportPayload): Observable<ImportResponse> {
    return this.http.post<ImportResponse>(`${API_URL}/import/expenses`, payload);
  }
}