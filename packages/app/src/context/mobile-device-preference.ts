export interface MobileDevicePreference {
  preferredDeviceID: string
  endpoint: string
  autoReconnect: boolean
}

export const defaultMobileDevicePreference: MobileDevicePreference = {
  preferredDeviceID: "",
  endpoint: "",
  autoReconnect: false,
}

export function normalizeMobileDevicePreference(
  input: Partial<MobileDevicePreference> | undefined,
): MobileDevicePreference {
  const preferredDeviceID = input?.preferredDeviceID?.trim() ?? ""
  return {
    preferredDeviceID,
    endpoint: input?.endpoint?.trim() ?? "",
    autoReconnect: preferredDeviceID.length > 0 && input?.autoReconnect === true,
  }
}
