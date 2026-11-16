/*********************************************************************
 * Copyright (c) Intel Corporation 2026
 * SPDX-License-Identifier: Apache-2.0
 **********************************************************************/

import { HttpClient } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { Observable, throwError } from 'rxjs'
import { catchError } from 'rxjs/operators'
import { environment } from '../../environments/environment'
import { AuthService } from '../auth.service'
import { EACertificateAuthorityInfo, EASettings, EASettingsInput, EATestResult } from './enterprise-assistant.constants'

@Injectable({
  providedIn: 'root'
})
export class EnterpriseAssistantService {
  private readonly http = inject(HttpClient)
  private readonly authService = inject(AuthService)

  private readonly url = `${environment.rpsServer}/api/v2/admin/enterprise-assistant`

  getSettings(): Observable<EASettings> {
    return this.http.get<EASettings>(`${this.url}/settings`).pipe(catchError((err) => this.handleError(err)))
  }

  updateSettings(settings: EASettingsInput): Observable<EASettings> {
    return this.http.put<EASettings>(`${this.url}/settings`, settings).pipe(catchError((err) => this.handleError(err)))
  }

  // Without settings the server tests the stored ones.
  test(settings?: EASettingsInput): Observable<EATestResult> {
    return this.http
      .post<EATestResult>(`${this.url}/test`, settings ?? null)
      .pipe(catchError((err) => this.handleError(err)))
  }

  getContainers(): Observable<string[]> {
    return this.http.get<string[]>(`${this.url}/ad/containers`).pipe(catchError((err) => this.handleError(err)))
  }

  getGroups(): Observable<string[]> {
    return this.http.get<string[]>(`${this.url}/ad/groups`).pipe(catchError((err) => this.handleError(err)))
  }

  getAuthorities(): Observable<EACertificateAuthorityInfo[]> {
    return this.http
      .get<EACertificateAuthorityInfo[]>(`${this.url}/ca/authorities`)
      .pipe(catchError((err) => this.handleError(err)))
  }

  // Console answers {"error": "..."}; fall back to the shared handler for anything else.
  private handleError(err: any): Observable<never> {
    const serverError = err?.error?.error
    const errorMessages: string[] =
      typeof serverError === 'string' && serverError !== '' ? [serverError] : this.authService.onError(err)
    return throwError(() => errorMessages)
  }
}
