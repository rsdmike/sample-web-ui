/*********************************************************************
 * Copyright (c) Intel Corporation 2026
 * SPDX-License-Identifier: Apache-2.0
 **********************************************************************/

import { FormOption } from '../../models/models'

// Shapes of the Console settings API (/api/v2/admin/enterprise-assistant).

export type DeviceNameType = 'hostname' | 'nodeid'

export type CertificateNameField =
  | 'distinguishedname'
  | 'dnsfqdn'
  | 'hostname'
  | 'userprincipalname'
  | 'samaccountname'
  | 'uuid'

export interface EAActiveDirectoryInput {
  domain: string
  server: string
  bindUsername: string
  // '' keeps the stored password
  bindPassword: string
  computerOU: string
  securityGroups: string[]
  insecureSkipVerify: boolean
}

export interface EACertificateAuthoritySettings {
  host: string
  name: string
  template: string
  commonName: CertificateNameField
  altNames: CertificateNameField[]
}

// PUT /settings and POST /test body: the GET shape minus the *Set flags.
export interface EASettingsInput {
  enabled: boolean
  url: string
  username: string
  // '' keeps the stored password
  password: string
  deviceNameType: DeviceNameType
  activeDirectory: EAActiveDirectoryInput
  certificateAuthority: EACertificateAuthoritySettings
}

export interface EAActiveDirectory extends EAActiveDirectoryInput {
  bindPasswordSet: boolean
}

// GET /settings (and the PUT response). Passwords are always ''.
export interface EASettings extends EASettingsInput {
  passwordSet: boolean
  activeDirectory: EAActiveDirectory
}

export interface EACheckResult {
  ok: boolean
  message: string
}

export interface EATestResult {
  activeDirectory: EACheckResult
  certificateAuthority: EACheckResult
}

export interface EACertificateAuthorityInfo {
  name: string
  host: string
  templates: string[]
}

export const DeviceNameTypes: FormOption<DeviceNameType>[] = [
  { value: 'hostname', label: 'enterpriseAssistant.deviceNameType.hostname.value' },
  { value: 'nodeid', label: 'enterpriseAssistant.deviceNameType.nodeid.value' }
]

export const CertificateNameFields: FormOption<CertificateNameField>[] = [
  { value: 'distinguishedname', label: 'enterpriseAssistant.nameField.distinguishedname.value' },
  { value: 'dnsfqdn', label: 'enterpriseAssistant.nameField.dnsfqdn.value' },
  { value: 'hostname', label: 'enterpriseAssistant.nameField.hostname.value' },
  { value: 'userprincipalname', label: 'enterpriseAssistant.nameField.userprincipalname.value' },
  { value: 'samaccountname', label: 'enterpriseAssistant.nameField.samaccountname.value' },
  { value: 'uuid', label: 'enterpriseAssistant.nameField.uuid.value' }
]
