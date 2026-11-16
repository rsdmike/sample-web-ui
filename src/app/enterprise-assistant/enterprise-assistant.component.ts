/*********************************************************************
 * Copyright (c) Intel Corporation 2026
 * SPDX-License-Identifier: Apache-2.0
 **********************************************************************/

import { Component, OnInit, computed, inject, signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn } from '@angular/forms'
import { ENTER } from '@angular/cdk/keycodes'
import { MatAutocomplete, MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete'
import { MatButton } from '@angular/material/button'
import { MatCard, MatCardActions, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card'
import { MatCheckbox } from '@angular/material/checkbox'
import { MatChipGrid, MatChipInput, MatChipInputEvent, MatChipRemove, MatChipRow } from '@angular/material/chips'
import { MatOption } from '@angular/material/core'
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field'
import { MatIcon } from '@angular/material/icon'
import { MatInput } from '@angular/material/input'
import { MatProgressBar } from '@angular/material/progress-bar'
import { MatSelect } from '@angular/material/select'
import { MatSlideToggle } from '@angular/material/slide-toggle'
import { MatSnackBar } from '@angular/material/snack-bar'
import { MatToolbar } from '@angular/material/toolbar'
import { TranslatePipe, TranslateService } from '@ngx-translate/core'
import { Observable } from 'rxjs'
import { finalize } from 'rxjs/operators'
import SnackbarDefaults from '../shared/config/snackBarDefault'
import { EnterpriseAssistantService } from './enterprise-assistant.service'
import {
  CertificateNameField,
  CertificateNameFields,
  DeviceNameType,
  DeviceNameTypes,
  EACertificateAuthorityInfo,
  EASettings,
  EASettingsInput,
  EATestResult
} from './enterprise-assistant.constants'

const isBlank = (value: unknown): boolean => typeof value !== 'string' || value.trim() === ''

@Component({
  selector: 'app-enterprise-assistant',
  templateUrl: './enterprise-assistant.component.html',
  styleUrl: './enterprise-assistant.component.scss',
  imports: [
    ReactiveFormsModule,
    MatToolbar,
    MatProgressBar,
    MatCard,
    MatCardHeader,
    MatCardTitle,
    MatCardContent,
    MatCardActions,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
    MatSlideToggle,
    MatCheckbox,
    MatAutocomplete,
    MatAutocompleteTrigger,
    MatChipGrid,
    MatChipRow,
    MatChipInput,
    MatChipRemove,
    MatButton,
    MatIcon,
    TranslatePipe
  ]
})
export class EnterpriseAssistantComponent implements OnInit {
  private readonly fb = inject(FormBuilder)
  private readonly eaService = inject(EnterpriseAssistantService)
  private readonly snackBar = inject(MatSnackBar)
  private readonly translate = inject(TranslateService)

  readonly deviceNameTypes = DeviceNameTypes
  readonly nameFields = CertificateNameFields
  // DNs contain commas, so only Enter ends a typed security group.
  readonly separatorKeysCodes: number[] = [ENTER]

  readonly passwordSet = signal(false)
  readonly bindPasswordSet = signal(false)
  readonly isLoading = signal(false)
  readonly errorMessages = signal<string[]>([])
  readonly testResult = signal<EATestResult | null>(null)
  readonly containers = signal<string[]>([])
  readonly groups = signal<string[]>([])
  readonly authorities = signal<EACertificateAuthorityInfo[]>([])
  readonly selectedAuthority = signal<EACertificateAuthorityInfo | null>(null)
  readonly templates = computed(() => this.selectedAuthority()?.templates ?? [])

  readonly form = this.fb.nonNullable.group({
    enabled: [false],
    url: [''],
    username: ['', [this.requiredWhenEnabled()]],
    password: [''],
    deviceNameType: ['hostname' as DeviceNameType],
    activeDirectory: this.fb.nonNullable.group({
      domain: ['', [this.requiredWhenEnabled()]],
      server: [''],
      bindUsername: ['', [this.requiredWhenEnabled()]],
      bindPassword: ['', [this.requiredWhenEnabled(() => !this.bindPasswordSet())]],
      computerOU: [''],
      securityGroups: [[] as string[]],
      insecureSkipVerify: [false]
    }),
    certificateAuthority: this.fb.nonNullable.group({
      host: [''],
      name: [''],
      template: [''],
      commonName: ['dnsfqdn' as CertificateNameField],
      altNames: [[] as CertificateNameField[]]
    })
  })

  private readonly computerOU = toSignal(this.form.controls.activeDirectory.controls.computerOU.valueChanges, {
    initialValue: ''
  })

  readonly filteredContainers = computed(() => {
    const typed = this.computerOU().toLowerCase()
    return this.containers().filter((c) => c.toLowerCase().includes(typed))
  })

  constructor() {
    this.form.controls.enabled.valueChanges.subscribe(() => {
      this.revalidateRequired()
    })
  }

  ngOnInit(): void {
    this.isLoading.set(true)
    this.eaService
      .getSettings()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (settings) => this.loadForm(settings),
        error: (err) => this.showError('enterpriseAssistant.errorLoad.value', err)
      })
  }

  // Required only while EA is enabled; `also` narrows it further (e.g. no stored password).
  private requiredWhenEnabled(also: () => boolean = () => true): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const enabled = control.root.get('enabled')?.value === true
      return enabled && also() && isBlank(control.value) ? { required: true } : null
    }
  }

  private revalidateRequired(): void {
    const ad = this.form.controls.activeDirectory.controls
    for (const control of [
      this.form.controls.username,
      ad.domain,
      ad.bindUsername,
      ad.bindPassword
    ]) {
      control.updateValueAndValidity({ emitEvent: false })
    }
    this.form.updateValueAndValidity({ emitEvent: false })
  }

  private loadForm(settings: EASettings): void {
    this.passwordSet.set(settings.passwordSet)
    this.bindPasswordSet.set(settings.activeDirectory.bindPasswordSet)
    this.form.reset({
      enabled: settings.enabled,
      url: settings.url,
      username: settings.username,
      password: '',
      deviceNameType: settings.deviceNameType,
      activeDirectory: {
        domain: settings.activeDirectory.domain,
        server: settings.activeDirectory.server,
        bindUsername: settings.activeDirectory.bindUsername,
        bindPassword: '',
        computerOU: settings.activeDirectory.computerOU,
        securityGroups: [...(settings.activeDirectory.securityGroups ?? [])],
        insecureSkipVerify: settings.activeDirectory.insecureSkipVerify
      },
      certificateAuthority: {
        ...settings.certificateAuthority,
        altNames: [...(settings.certificateAuthority.altNames ?? [])]
      }
    })
    this.revalidateRequired()
    this.matchAuthority()
  }

  // The settings exactly as the API expects them: '' for a password means "keep the stored one".
  private formToSettings(): EASettingsInput {
    const value = this.form.getRawValue()
    return {
      ...value,
      activeDirectory: { ...value.activeDirectory, securityGroups: [...value.activeDirectory.securityGroups] },
      certificateAuthority: { ...value.certificateAuthority, altNames: [...value.certificateAuthority.altNames] }
    }
  }

  get canSave(): boolean {
    return this.form.valid && this.form.dirty && !this.isLoading()
  }

  useThisConsole(): void {
    this.form.controls.url.setValue(`${window.location.origin}/ea`)
    this.form.controls.url.markAsDirty()
  }

  loadContainers(): void {
    this.runLookup(this.eaService.getContainers(), (containers) => this.containers.set(containers))
  }

  loadGroups(): void {
    this.runLookup(this.eaService.getGroups(), (groups) => this.groups.set(groups))
  }

  loadAuthorities(): void {
    this.runLookup(this.eaService.getAuthorities(), (authorities) => {
      this.authorities.set(authorities)
      this.matchAuthority()
    })
  }

  private runLookup<T>(request: Observable<T>, next: (value: T) => void): void {
    this.isLoading.set(true)
    request.pipe(finalize(() => this.isLoading.set(false))).subscribe({
      next,
      error: (err) => this.showError('enterpriseAssistant.errorLookup.value', err)
    })
  }

  // Preselect the loaded CA that the stored settings name, so its templates are offered.
  private matchAuthority(): void {
    const name = this.form.controls.certificateAuthority.controls.name.value.toLowerCase()
    this.selectedAuthority.set(this.authorities().find((a) => a.name.toLowerCase() === name) ?? null)
  }

  selectAuthority(authority: EACertificateAuthorityInfo): void {
    this.selectedAuthority.set(authority)
    const ca = this.form.controls.certificateAuthority.controls
    const template = authority.templates.includes(ca.template.value)
      ? ca.template.value
      : (authority.templates[0] ?? '')
    this.form.controls.certificateAuthority.patchValue({ host: authority.host, name: authority.name, template })
    this.form.controls.certificateAuthority.markAsDirty()
  }

  addGroup(event: MatChipInputEvent): void {
    this.addGroupValue(event.value)
    event.chipInput.clear()
  }

  groupSelected(event: MatAutocompleteSelectedEvent, input: HTMLInputElement): void {
    this.addGroupValue(event.option.value as string)
    input.value = ''
  }

  private addGroupValue(value: string): void {
    const dn = value.trim()
    const control = this.form.controls.activeDirectory.controls.securityGroups
    if (dn === '' || control.value.some((g) => g.toLowerCase() === dn.toLowerCase())) {
      return
    }
    control.setValue([...control.value, dn])
    control.markAsDirty()
  }

  removeGroup(dn: string): void {
    const control = this.form.controls.activeDirectory.controls.securityGroups
    control.setValue(control.value.filter((g) => g !== dn))
    control.markAsDirty()
  }

  isAltName(field: CertificateNameField): boolean {
    return this.form.controls.certificateAuthority.controls.altNames.value.includes(field)
  }

  toggleAltName(field: CertificateNameField, checked: boolean): void {
    const control = this.form.controls.certificateAuthority.controls.altNames
    const others = control.value.filter((f) => f !== field)
    // keep the canonical order of the options
    const next = checked ? this.nameFields.map((f) => f.value).filter((f) => f === field || others.includes(f)) : others
    control.setValue(next)
    control.markAsDirty()
  }

  testConnection(): void {
    this.errorMessages.set([])
    this.testResult.set(null)
    this.isLoading.set(true)
    this.eaService
      .test(this.formToSettings())
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (result) => this.testResult.set(result),
        error: (err) => this.showError('enterpriseAssistant.errorTest.value', err)
      })
  }

  onSubmit(): void {
    if (!this.canSave) {
      return
    }
    this.errorMessages.set([])
    this.isLoading.set(true)
    this.eaService
      .updateSettings(this.formToSettings())
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (settings) => {
          this.loadForm(settings)
          this.snackBar.open(
            this.translate.instant('enterpriseAssistant.saved.value'),
            undefined,
            SnackbarDefaults.defaultSuccess
          )
        },
        error: (err) => this.showError('enterpriseAssistant.errorSave.value', err)
      })
  }

  private showError(key: string, err: unknown): void {
    const messages = Array.isArray(err) ? err.map(String) : [String(err)]
    this.errorMessages.set(messages)
    this.snackBar.open(this.translate.instant(key), undefined, SnackbarDefaults.defaultError)
  }
}
