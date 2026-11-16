/*********************************************************************
 * Copyright (c) Intel Corporation 2026
 * SPDX-License-Identifier: Apache-2.0
 **********************************************************************/

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSpyObj, type SpyObj } from '../../test-helpers'
import { ComponentFixture, TestBed } from '@angular/core/testing'
import { MatSnackBar } from '@angular/material/snack-bar'
import { provideTranslateService } from '@ngx-translate/core'
import { of, throwError } from 'rxjs'
import { EnterpriseAssistantComponent } from './enterprise-assistant.component'
import { EnterpriseAssistantService } from './enterprise-assistant.service'
import { EASettings } from './enterprise-assistant.constants'

describe('EnterpriseAssistantComponent', () => {
  let component: EnterpriseAssistantComponent
  let fixture: ComponentFixture<EnterpriseAssistantComponent>
  let eaService: SpyObj<EnterpriseAssistantService>
  let snackBar: SpyObj<MatSnackBar>

  const stored = (): EASettings => ({
    enabled: true,
    url: 'https://console.vprodemo.com:8181/ea',
    username: 'eauser',
    password: '',
    passwordSet: true,
    deviceNameType: 'hostname',
    activeDirectory: {
      domain: 'vprodemo.com',
      server: 'dc1.vprodemo.com:636',
      bindUsername: 'svc-ea@vprodemo.com',
      bindPassword: '',
      bindPasswordSet: true,
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
  })

  const unset = (): EASettings => ({
    ...stored(),
    enabled: false,
    username: '',
    passwordSet: false,
    activeDirectory: { ...stored().activeDirectory, domain: '', bindUsername: '', bindPasswordSet: false }
  })

  const el = (selector: string): HTMLElement | null => fixture.nativeElement.querySelector(selector)

  const setup = async (settings: EASettings = stored()): Promise<void> => {
    eaService.getSettings.mockReturnValue(of(settings))
    fixture = TestBed.createComponent(EnterpriseAssistantComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
    await fixture.whenStable()
  }

  const render = async (): Promise<void> => {
    fixture.detectChanges()
    await fixture.whenStable()
  }

  beforeEach(() => {
    eaService = createSpyObj('EnterpriseAssistantService', [
      'getSettings',
      'updateSettings',
      'test',
      'getContainers',
      'getGroups',
      'getAuthorities'
    ])
    snackBar = createSpyObj('MatSnackBar', ['open'])
    TestBed.configureTestingModule({
      imports: [EnterpriseAssistantComponent],
      providers: [
        provideTranslateService(),
        { provide: EnterpriseAssistantService, useValue: eaService },
        { provide: MatSnackBar, useValue: snackBar }
      ]
    })
  })

  afterEach(() => {
    TestBed.resetTestingModule()
  })

  it('should load the settings into the form with blank passwords', async () => {
    await setup()
    expect(eaService.getSettings).toHaveBeenCalled()
    const value = component.form.getRawValue()
    expect(value.url).toBe('https://console.vprodemo.com:8181/ea')
    expect(value.username).toBe('eauser')
    expect(value.password).toBe('')
    expect(value.activeDirectory.domain).toBe('vprodemo.com')
    expect(value.activeDirectory.bindPassword).toBe('')
    expect(value.activeDirectory.securityGroups).toEqual(['CN=AMT Devices,CN=Users,DC=vprodemo,DC=com'])
    expect(value.certificateAuthority.altNames).toEqual(['dnsfqdn', 'uuid'])
    expect(component.form.pristine).toBe(true)
    expect(component.form.valid).toBe(true)
    expect(el('mat-chip-row')?.textContent).toContain('CN=AMT Devices')
    expect((el('[data-cy="eaAltName-uuid"] input') as HTMLInputElement).checked).toBe(true)
    expect((el('[data-cy="eaAltName-hostname"] input') as HTMLInputElement).checked).toBe(false)
  })

  it('should show the keep-blank placeholder only for stored passwords', async () => {
    await setup({
      ...stored(),
      passwordSet: false,
      activeDirectory: { ...stored().activeDirectory, bindPasswordSet: true }
    })
    expect(el('[data-cy="eaPassword"]')?.getAttribute('placeholder') ?? '').toBe('')
    expect(el('[data-cy="eaBindPassword"]')?.getAttribute('placeholder')).toBe('enterpriseAssistant.passwordKeep.value')
  })

  it('should show the load error from the server', async () => {
    eaService.getSettings.mockReturnValue(throwError(() => ['enterprise assistant: boom']))
    fixture = TestBed.createComponent(EnterpriseAssistantComponent)
    component = fixture.componentInstance
    await render()
    expect(snackBar.open).toHaveBeenCalled()
    expect(el('[data-cy="eaErrors"]')?.textContent).toContain('enterprise assistant: boom')
  })

  it('should disable Save while the form is pristine', async () => {
    await setup()
    expect((el('[data-cy="eaSave"]') as HTMLButtonElement).disabled).toBe(true)
    component.form.controls.username.setValue('other')
    component.form.controls.username.markAsDirty()
    await render()
    expect((el('[data-cy="eaSave"]') as HTMLButtonElement).disabled).toBe(false)
  })

  it('should send empty passwords when untouched and reload the form from the response', async () => {
    await setup()
    const saved = { ...stored(), username: 'renamed' }
    eaService.updateSettings.mockReturnValue(of(saved))
    component.form.controls.username.setValue('renamed')
    component.form.controls.username.markAsDirty()
    await render()
    el('[data-cy="eaSave"]')?.click()
    await render()

    expect(eaService.updateSettings).toHaveBeenCalledTimes(1)
    const body = eaService.updateSettings.mock.calls[0][0]
    expect(body.password).toBe('')
    expect(body.activeDirectory.bindPassword).toBe('')
    expect(body.username).toBe('renamed')
    expect('passwordSet' in body).toBe(false)
    expect('bindPasswordSet' in body.activeDirectory).toBe(false)
    expect(snackBar.open).toHaveBeenCalledWith('enterpriseAssistant.saved.value', undefined, expect.anything())
    expect(component.form.pristine).toBe(true)
    expect(component.form.controls.username.value).toBe('renamed')
  })

  it('should send typed passwords', async () => {
    await setup()
    eaService.updateSettings.mockReturnValue(of(stored()))
    component.form.controls.password.setValue('ea-secret')
    component.form.controls.activeDirectory.controls.bindPassword.setValue('bind-secret')
    component.form.markAsDirty()
    component.onSubmit()
    const body = eaService.updateSettings.mock.calls[0][0]
    expect(body.password).toBe('ea-secret')
    expect(body.activeDirectory.bindPassword).toBe('bind-secret')
    // the response carries no passwords, so the fields are blank again
    expect(component.form.controls.password.value).toBe('')
  })

  it('should show the server error when saving fails', async () => {
    await setup()
    eaService.updateSettings.mockReturnValue(throwError(() => ['bind password is required']))
    component.form.markAsDirty()
    component.onSubmit()
    await render()
    expect(snackBar.open).toHaveBeenCalledWith('enterpriseAssistant.errorSave.value', undefined, expect.anything())
    expect(el('[data-cy="eaErrors"]')?.textContent).toContain('bind password is required')
    expect(component.isLoading()).toBe(false)
  })

  it('should require the Contract B fields only when enabled', async () => {
    await setup(unset())
    const ad = component.form.controls.activeDirectory.controls
    expect(component.form.valid).toBe(true)

    component.form.controls.enabled.setValue(true)
    expect(component.form.valid).toBe(false)
    expect(component.form.controls.username.hasError('required')).toBe(true)
    expect(ad.domain.hasError('required')).toBe(true)
    expect(ad.bindUsername.hasError('required')).toBe(true)
    expect(ad.bindPassword.hasError('required')).toBe(true)
    // the EA password is not required by the API
    expect(component.form.controls.password.valid).toBe(true)

    component.form.patchValue({
      username: 'eauser',
      activeDirectory: { domain: 'vprodemo.com', bindUsername: 'svc@vprodemo.com', bindPassword: 'x' }
    })
    expect(component.form.valid).toBe(true)

    component.form.controls.enabled.setValue(false)
    component.form.patchValue({ username: '', activeDirectory: { domain: '' } })
    expect(component.form.valid).toBe(true)
  })

  it('should not require the bind password when one is stored', async () => {
    await setup()
    expect(component.form.controls.activeDirectory.controls.bindPassword.value).toBe('')
    expect(component.form.controls.activeDirectory.controls.bindPassword.valid).toBe(true)
    expect(component.form.valid).toBe(true)
  })

  it('should fill the URL from this Console', async () => {
    await setup(unset())
    el('[data-cy="eaUseThisConsole"]')?.click()
    expect(component.form.controls.url.value).toBe(`${window.location.origin}/ea`)
    expect(component.form.dirty).toBe(true)
  })

  it('should load the computer OUs from AD for the autocomplete', async () => {
    await setup()
    eaService.getContainers.mockReturnValue(of(['CN=Computers', 'OU=AMT,OU=Devices']))
    el('[data-cy="eaLoadContainers"]')?.click()
    expect(eaService.getContainers).toHaveBeenCalled()
    expect(component.containers()).toEqual(['CN=Computers', 'OU=AMT,OU=Devices'])
    component.form.controls.activeDirectory.controls.computerOU.setValue('amt')
    expect(component.filteredContainers()).toEqual(['OU=AMT,OU=Devices'])
  })

  it('should load groups from AD and add picked or typed DNs', async () => {
    await setup(unset())
    eaService.getGroups.mockReturnValue(of(['CN=AMT Devices,CN=Users,DC=vprodemo,DC=com']))
    el('[data-cy="eaLoadGroups"]')?.click()
    expect(component.groups()).toEqual(['CN=AMT Devices,CN=Users,DC=vprodemo,DC=com'])

    const groups = component.form.controls.activeDirectory.controls.securityGroups
    groups.setValue([])
    const input = document.createElement('input')
    component.groupSelected({ option: { value: 'CN=AMT Devices,CN=Users,DC=vprodemo,DC=com' } } as any, input)
    component.addGroup({ value: ' CN=Typed,DC=vprodemo,DC=com ', chipInput: { clear: () => undefined } } as any)
    // duplicates are ignored
    component.addGroup({ value: 'cn=typed,dc=vprodemo,dc=com', chipInput: { clear: () => undefined } } as any)
    expect(groups.value).toEqual(['CN=AMT Devices,CN=Users,DC=vprodemo,DC=com', 'CN=Typed,DC=vprodemo,DC=com'])
    component.removeGroup('CN=Typed,DC=vprodemo,DC=com')
    expect(groups.value).toEqual(['CN=AMT Devices,CN=Users,DC=vprodemo,DC=com'])
    expect(groups.dirty).toBe(true)
  })

  it('should show the server error when a lookup fails', async () => {
    await setup(unset())
    eaService.getGroups.mockReturnValue(throwError(() => ['enterprise assistant: active directory is not configured']))
    component.loadGroups()
    await render()
    expect(snackBar.open).toHaveBeenCalledWith('enterpriseAssistant.errorLookup.value', undefined, expect.anything())
    expect(el('[data-cy="eaErrors"]')?.textContent).toContain('active directory is not configured')
  })

  it('should keep CA fields as text until authorities are loaded', async () => {
    await setup(unset())
    expect(el('[data-cy="eaAuthority"]')).toBeNull()
    expect(el('input[data-cy="eaTemplate"]')).not.toBeNull()
    expect(el('[data-cy="eaTemplateSelect"]')).toBeNull()
  })

  it('should fill host, name and templates when a CA is chosen', async () => {
    await setup({
      ...stored(),
      certificateAuthority: { ...stored().certificateAuthority, host: '', name: '', template: '' }
    })
    const authorities = [
      { name: 'vprodemo-CA', host: 'ca1.vprodemo.com', templates: ['AMT8021X', 'WebServer'] },
      { name: 'other-CA', host: 'ca2.vprodemo.com', templates: ['Machine'] }
    ]
    eaService.getAuthorities.mockReturnValue(of(authorities))
    el('[data-cy="eaLoadAuthorities"]')?.click()
    await render()
    expect(el('[data-cy="eaAuthority"]')).not.toBeNull()

    component.selectAuthority(authorities[1])
    await render()
    const ca = component.form.controls.certificateAuthority.getRawValue()
    expect(ca.host).toBe('ca2.vprodemo.com')
    expect(ca.name).toBe('other-CA')
    expect(ca.template).toBe('Machine')
    expect(component.templates()).toEqual(['Machine'])
    expect(el('[data-cy="eaTemplateSelect"]')).not.toBeNull()
    expect(component.form.dirty).toBe(true)
  })

  it('should preselect the stored CA once authorities are loaded', async () => {
    await setup()
    eaService.getAuthorities.mockReturnValue(
      of([{ name: 'VPRODEMO-ca', host: 'ca1.vprodemo.com', templates: ['AMT8021X', 'WebServer'] }])
    )
    component.loadAuthorities()
    expect(component.selectedAuthority()?.name).toBe('VPRODEMO-ca')
    expect(component.templates()).toEqual(['AMT8021X', 'WebServer'])
  })

  it('should keep alt names in option order when toggled', async () => {
    await setup()
    component.toggleAltName('distinguishedname', true)
    component.toggleAltName('uuid', false)
    expect(component.form.controls.certificateAuthority.controls.altNames.value).toEqual([
      'distinguishedname',
      'dnsfqdn'
    ])
  })

  it('should test the current form values and show both results', async () => {
    await setup()
    eaService.test.mockReturnValue(
      of({
        activeDirectory: { ok: true, message: 'Bound to dc1.vprodemo.com as svc-ea@vprodemo.com' },
        certificateAuthority: { ok: false, message: 'adcs: connection refused' }
      })
    )
    component.form.controls.activeDirectory.controls.bindPassword.setValue('typed')
    el('[data-cy="eaTest"]')?.click()
    await render()

    const body = eaService.test.mock.calls[0][0]
    expect(body?.activeDirectory.bindPassword).toBe('typed')
    expect(body?.password).toBe('')
    const ad = el('[data-cy="eaTestAD"]')
    const ca = el('[data-cy="eaTestCA"]')
    expect(ad?.textContent).toContain('Bound to dc1.vprodemo.com')
    expect(ad?.querySelector('mat-icon')?.textContent?.trim()).toBe('check_circle')
    expect(ca?.textContent).toContain('adcs: connection refused')
    expect(ca?.querySelector('mat-icon')?.textContent?.trim()).toBe('error')
  })

  it('should show the server error when the test request fails', async () => {
    await setup()
    eaService.test.mockReturnValue(throwError(() => ['invalid commonName']))
    component.testConnection()
    await render()
    expect(el('[data-cy="eaTestResults"]')).toBeNull()
    expect(el('[data-cy="eaErrors"]')?.textContent).toContain('invalid commonName')
  })

  it('should show the TLS warning only when verification is skipped', async () => {
    await setup()
    expect(el('[data-cy="eaInsecureWarning"]')).toBeNull()
    component.form.controls.activeDirectory.controls.insecureSkipVerify.setValue(true)
    await render()
    expect(el('[data-cy="eaInsecureWarning"]')).not.toBeNull()
  })
})
