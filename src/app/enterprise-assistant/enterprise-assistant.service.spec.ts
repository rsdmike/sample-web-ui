/*********************************************************************
 * Copyright (c) Intel Corporation 2026
 * SPDX-License-Identifier: Apache-2.0
 **********************************************************************/

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSpyObj, type SpyObj } from '../../test-helpers'
import { TestBed } from '@angular/core/testing'
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing'
import { provideHttpClient } from '@angular/common/http'
import { EnterpriseAssistantService } from './enterprise-assistant.service'
import { AuthService } from '../auth.service'
import { environment } from '../../environments/environment'
import { EASettings, EASettingsInput, EATestResult } from './enterprise-assistant.constants'

describe('EnterpriseAssistantService', () => {
  let service: EnterpriseAssistantService
  let httpMock: HttpTestingController
  let authServiceSpy: SpyObj<AuthService>

  const mockUrl = 'https://test-server/api/v2/admin/enterprise-assistant'

  const input: EASettingsInput = {
    enabled: true,
    url: 'https://console.vprodemo.com:8181/ea',
    username: 'eauser',
    password: '',
    deviceNameType: 'hostname',
    activeDirectory: {
      domain: 'vprodemo.com',
      server: 'dc1.vprodemo.com:636',
      bindUsername: 'svc-ea@vprodemo.com',
      bindPassword: '',
      computerOU: 'CN=Computers',
      securityGroups: ['CN=AMT Devices,CN=Users,DC=vprodemo,DC=com'],
      insecureSkipVerify: false
    },
    certificateAuthority: {
      host: 'ca1.vprodemo.com',
      name: 'vprodemo-CA',
      template: 'AMT8021X',
      commonName: 'dnsfqdn',
      altNames: ['dnsfqdn', 'uuid']
    }
  }
  const settings: EASettings = {
    ...input,
    passwordSet: true,
    activeDirectory: { ...input.activeDirectory, bindPasswordSet: true }
  }

  beforeEach(() => {
    authServiceSpy = createSpyObj('AuthService', ['onError'])
    environment.rpsServer = 'https://test-server'
    TestBed.configureTestingModule({
      providers: [
        EnterpriseAssistantService,
        { provide: AuthService, useValue: authServiceSpy },
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    })
    service = TestBed.inject(EnterpriseAssistantService)
    httpMock = TestBed.inject(HttpTestingController)
  })

  afterEach(() => {
    httpMock.verify()
  })

  it('should GET the settings', () => {
    let result: EASettings | undefined
    service.getSettings().subscribe((r) => (result = r))
    const req = httpMock.expectOne(`${mockUrl}/settings`)
    expect(req.request.method).toBe('GET')
    req.flush(settings)
    expect(result).toEqual(settings)
  })

  it('should PUT the settings', () => {
    let result: EASettings | undefined
    service.updateSettings(input).subscribe((r) => (result = r))
    const req = httpMock.expectOne(`${mockUrl}/settings`)
    expect(req.request.method).toBe('PUT')
    expect(req.request.body).toEqual(input)
    req.flush(settings)
    expect(result).toEqual(settings)
  })

  it('should POST the given settings to test', () => {
    const testResult: EATestResult = {
      activeDirectory: { ok: true, message: 'Bound' },
      certificateAuthority: { ok: false, message: 'not configured' }
    }
    let result: EATestResult | undefined
    service.test(input).subscribe((r) => (result = r))
    const req = httpMock.expectOne(`${mockUrl}/test`)
    expect(req.request.method).toBe('POST')
    expect(req.request.body).toEqual(input)
    req.flush(testResult)
    expect(result).toEqual(testResult)
  })

  it('should POST an empty body to test the stored settings', () => {
    service.test().subscribe()
    const req = httpMock.expectOne(`${mockUrl}/test`)
    expect(req.request.method).toBe('POST')
    expect(req.request.body).toBeNull()
    req.flush({})
  })

  it('should GET the AD containers', () => {
    let result: string[] | undefined
    service.getContainers().subscribe((r) => (result = r))
    const req = httpMock.expectOne(`${mockUrl}/ad/containers`)
    expect(req.request.method).toBe('GET')
    req.flush(['CN=Computers', 'OU=AMT,OU=Devices'])
    expect(result).toEqual(['CN=Computers', 'OU=AMT,OU=Devices'])
  })

  it('should GET the AD groups', () => {
    let result: string[] | undefined
    service.getGroups().subscribe((r) => (result = r))
    const req = httpMock.expectOne(`${mockUrl}/ad/groups`)
    expect(req.request.method).toBe('GET')
    req.flush(['CN=AMT Devices,CN=Users,DC=vprodemo,DC=com'])
    expect(result).toEqual(['CN=AMT Devices,CN=Users,DC=vprodemo,DC=com'])
  })

  it('should GET the certificate authorities', () => {
    const authorities = [{ name: 'vprodemo-CA', host: 'ca1.vprodemo.com', templates: ['AMT8021X', 'WebServer'] }]
    let result: unknown
    service.getAuthorities().subscribe((r) => (result = r))
    const req = httpMock.expectOne(`${mockUrl}/ca/authorities`)
    expect(req.request.method).toBe('GET')
    req.flush(authorities)
    expect(result).toEqual(authorities)
  })

  it('should surface the server error text from {"error": "..."}', () => {
    let error: unknown
    service.getContainers().subscribe({ error: (e) => (error = e) })
    httpMock
      .expectOne(`${mockUrl}/ad/containers`)
      .flush(
        { error: 'enterprise assistant: active directory is not configured' },
        { status: 400, statusText: 'Bad Request' }
      )
    expect(error).toEqual(['enterprise assistant: active directory is not configured'])
    expect(authServiceSpy.onError).not.toHaveBeenCalled()
  })

  it('should fall back to AuthService.onError for other errors', () => {
    authServiceSpy.onError.mockReturnValue(['Error occurred'])
    let error: unknown
    service.updateSettings(input).subscribe({ error: (e) => (error = e) })
    httpMock.expectOne(`${mockUrl}/settings`).flush(null, { status: 500, statusText: 'Server Error' })
    expect(error).toEqual(['Error occurred'])
    expect(authServiceSpy.onError).toHaveBeenCalled()
  })
})
