import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type ReminderPermissionStatus =
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'unsupported';

const REMINDER_CHANNEL_ID = 'daily-check-in';
const REMINDER_KEY = 'money-leak:daily-check-in-reminder';
const REMINDER_HOUR = 21;
const REMINDER_MINUTE = 0;
const REMINDER_TITLE = 'Money Leak check-in';
const REMINDER_BODY = 'Log today’s expenses before they disappear from memory.';

let hasConfiguredNotificationHandler = false;

configureReminderNotificationHandler();

function configureReminderNotificationHandler() {
  if (hasConfiguredNotificationHandler) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  hasConfiguredNotificationHandler = true;
}

function normalizePermissionStatus(
  settings: Notifications.NotificationPermissionsStatus,
): ReminderPermissionStatus {
  const iosStatus = settings.ios?.status;

  if (
    settings.granted ||
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  ) {
    return 'granted';
  }

  return settings.canAskAgain ? 'undetermined' : 'denied';
}

async function ensureReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Daily check-in reminders',
    description: 'Local reminders to log the day before memory fades.',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function getScheduledReminderIdentifiers(): Promise<string[]> {
  const scheduledNotifications =
    await Notifications.getAllScheduledNotificationsAsync();

  return scheduledNotifications
    .filter((notificationRequest) => {
      return notificationRequest.content.data?.reminderKey === REMINDER_KEY;
    })
    .map((notificationRequest) => notificationRequest.identifier);
}

export async function getReminderPermissionStatus(): Promise<ReminderPermissionStatus> {
  const settings = await Notifications.getPermissionsAsync();

  return normalizePermissionStatus(settings);
}

export async function requestReminderPermissions(): Promise<ReminderPermissionStatus> {
  await ensureReminderChannel();

  const settings = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });

  return normalizePermissionStatus(settings);
}

export async function scheduleDailyCheckInReminder(): Promise<void> {
  const permissionStatus = await getReminderPermissionStatus();

  if (permissionStatus !== 'granted') {
    throw new Error('Reminder permission has not been granted.');
  }

  await ensureReminderChannel();
  await cancelDailyCheckInReminder();

  const trigger: Notifications.DailyTriggerInput =
    Platform.OS === 'android'
      ? {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: REMINDER_HOUR,
          minute: REMINDER_MINUTE,
          channelId: REMINDER_CHANNEL_ID,
        }
      : {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: REMINDER_HOUR,
          minute: REMINDER_MINUTE,
        };

  await Notifications.scheduleNotificationAsync({
    content: {
      title: REMINDER_TITLE,
      body: REMINDER_BODY,
      data: {
        reminderKey: REMINDER_KEY,
      },
    },
    trigger,
  });
}

export async function cancelDailyCheckInReminder(): Promise<void> {
  const scheduledReminderIdentifiers = await getScheduledReminderIdentifiers();

  await Promise.all(
    scheduledReminderIdentifiers.map((identifier) => {
      return Notifications.cancelScheduledNotificationAsync(identifier);
    }),
  );
}
