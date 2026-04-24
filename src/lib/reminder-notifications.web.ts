export type ReminderPermissionStatus =
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'unsupported';

export async function getReminderPermissionStatus(): Promise<ReminderPermissionStatus> {
  return 'unsupported';
}

export async function requestReminderPermissions(): Promise<ReminderPermissionStatus> {
  return 'unsupported';
}

export async function scheduleDailyCheckInReminder(): Promise<void> {
  return;
}

export async function cancelDailyCheckInReminder(): Promise<void> {
  return;
}
