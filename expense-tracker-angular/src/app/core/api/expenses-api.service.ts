import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { MessageResponse } from '../models/auth.model';
import type { Expense, ExpenseDraft, ExpensesResponse, SummaryResponse } from '../models/expense.model';
import { API_URL } from './api.config';

export interface ExpenseListParams {
  category?: string;
  month?: string;
  startDate?: string;
  endDate?: string;
}

export interface SummaryParams {
  startDate?: string;
  endDate?: string;
}

@Injectable({ providedIn: 'root' })
export class ExpensesApi {
  private http = inject(HttpClient);

  list(params: ExpenseListParams = {}): Observable<ExpensesResponse> {
    const httpParams = new HttpParams({ fromObject: params as Record<string, string> });
    return this.http.get<ExpensesResponse>(`${API_URL}/expenses`, { params: httpParams });
  }

  summary(params: SummaryParams = {}): Observable<SummaryResponse> {
    const httpParams = new HttpParams({ fromObject: params as Record<string, string> });
    return this.http.get<SummaryResponse>(`${API_URL}/expenses/summary`, { params: httpParams });
  }

  create(draft: ExpenseDraft): Observable<Expense> {
    return this.http.post<Expense>(`${API_URL}/expenses`, draft);
  }

  update(id: string, draft: ExpenseDraft): Observable<Expense> {
    return this.http.put<Expense>(`${API_URL}/expenses/${id}`, draft);
  }

  delete(id: string): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${API_URL}/expenses/${id}`);
  }
}