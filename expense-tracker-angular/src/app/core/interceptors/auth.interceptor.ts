import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { STORAGE_KEYS, clearAuth } from '../utils/storage';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem(STORAGE_KEYS.token);
  const headers = token ? req.headers.set('Authorization', `Bearer ${token}`) : req.headers;
  return next(req.clone({ headers })).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        clearAuth();
      }
      return throwError(() => err);
    })
  );
};