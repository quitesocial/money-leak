import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import {
  Alert,
  Animated,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryIconPicker } from '@/components/category-icon-picker';
import {
  getLastSuccessfulBackupAt,
  setLastSuccessfulBackupAt,
} from '@/db/backup-status';
import { getSyncMetadata } from '@/db/sync-status';
import { exportTransactionsCsv } from '@/features/export/export-transactions-csv';
import {
  IMPORT_TRANSACTIONS_UNSUPPORTED_ERROR_MESSAGE,
  pickTransactionsCsvImport,
} from '@/features/export/import-transactions-csv';
import { deleteAccountService } from '@/lib/account/delete-account-service';
import {
  appleAuthAdapter,
  getAppleAuthSafeErrorMessage,
} from '@/lib/auth/apple-auth-adapter';
import {
  getGoogleAuthSafeErrorMessage,
  googleAuthAdapter,
} from '@/lib/auth/google-auth-adapter';
import { APP_LINKS } from '@/lib/app-links';
import {
  CATEGORY_ICON_FALLBACK_NAME,
  getCategoryIcon,
  type CategoryIconName,
} from '@/lib/category-icons';
import {
  getArchiveCategoryError,
  validateCategoryName,
} from '@/lib/category-utils';
import { getValidDate } from '@/lib/date-utils';
import { featureFlags } from '@/lib/feature-flags';
import { getDefaultCategoryName, t } from '@/lib/i18n/i18n';
import {
  cancelDailyCheckInReminder,
  getReminderPermissionStatus,
  requestReminderPermissions,
  scheduleDailyCheckInReminder,
  type ReminderPermissionStatus,
} from '@/lib/reminder-notifications';
import { getReminderEnabled, setReminderEnabled } from '@/lib/reminder-storage';
import {
  DEFAULT_SETTINGS_CURRENCY,
  DEFAULT_SETTINGS_LANGUAGE,
  getCurrencyOptionLabel,
  getForegroundSyncEnabled,
  getSettingsCurrency,
  getSettingsLanguage,
  SETTINGS_CURRENCY_OPTIONS,
  SETTINGS_LANGUAGE_OPTIONS,
  setForegroundSyncEnabled,
  setSettingsCurrency,
  setSettingsLanguage,
  type SettingsCurrency,
  type SettingsLanguage,
} from '@/lib/settings-preferences';
import { manualBackupService } from '@/lib/sync/manual-backup-service';
import { manualRestoreService } from '@/lib/sync/manual-restore-service';
import { manualSyncService } from '@/lib/sync/manual-sync-service';
import type {
  SyncAttemptSource,
  SyncResult,
  SyncSummary,
} from '@/lib/sync/sync-types';
import { hasHorizontalSwipeIntent } from '@/lib/swipe-actions';
import { useBalanceRefresh } from '@/lib/use-balance-refresh';
import { useCategoriesRefresh } from '@/lib/use-categories-refresh';
import { notifySettingsCurrencyChanged } from '@/lib/use-settings-currency';
import { notifySettingsLanguageChanged } from '@/lib/use-settings-language';
import { useTransactionsRefresh } from '@/lib/use-transactions-refresh';
import { useAuthStore } from '@/store/auth-store';
import { useBalanceStore } from '@/store/balance-store';
import { useCategoriesStore } from '@/store/categories-store';
import { useTransactionsStore } from '@/store/transactions-store';
import type { AuthUser } from '@/types/auth';
import { OTHER_CATEGORY_ID, type Category } from '@/types/category';

type ImportResult = {
  importedCount: number;
  skippedCount: number;
};

type BackupResult = {
  uploadedTransactionsCount: number;
  uploadedCategoriesCount: number;
  uploadedBalanceTypesCount: number;
  uploadedBalanceEntriesCount: number;
  uploadedSettingsCount: number;
};

type RestoreUiResult = {
  restoredTransactionsCount: number;
  restoredCategoriesCount: number;
  restoredBalanceTypesCount: number;
  restoredBalanceEntriesCount: number;
  ignoredSettingsCount: number;
  restoredSettingsCount: number;
};

type SyncUiResult = {
  appliedCount: number;
  conflictsCount: number;
  ignoredCount: number;
  pulledCount: number;
  pushedCount: number;
};

type SettingsOptionSheet =
  | {
      kind: 'currency';
      title: string;
    }
  | {
      kind: 'language';
      title: string;
    };

const TITLE_FONT_FAMILY = Platform.select({
  ios: 'NewYork',
  default: 'serif',
});

const TITLE_FONT_WEIGHT = Platform.select({
  ios: '700' as const,
  default: '800' as const,
});

const CATEGORY_SWIPE_ACTION_SIZE = 52;
const CATEGORY_SWIPE_ACTION_GAP = 8;
const CATEGORY_SWIPE_REVEAL_WIDTH =
  CATEGORY_SWIPE_ACTION_SIZE + CATEGORY_SWIPE_ACTION_GAP;
const SWIPE_OPEN_THRESHOLD = 44;
const SWIPE_VELOCITY_THRESHOLD = 0.35;

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function getReminderPermissionError(
  permissionStatus: ReminderPermissionStatus,
) {
  if (permissionStatus === 'denied') {
    return 'Notifications are off for Money Leak. Turn them on in system settings to get the daily check-in.';
  }

  if (permissionStatus === 'unsupported') {
    return "Daily reminders aren't available on this platform.";
  }

  return 'Allow notifications to get the daily check-in.';
}

function clampCategorySwipeProgress(value: number) {
  return Math.max(-1, Math.min(1, value / CATEGORY_SWIPE_REVEAL_WIDTH));
}

function formatCountLabel(
  count: number,
  singularLabel: string,
  pluralLabel = `${singularLabel}s`,
) {
  return `${count} ${count === 1 ? singularLabel : pluralLabel}`;
}

function formatImportResult({ importedCount, skippedCount }: ImportResult) {
  return `Imported ${formatCountLabel(importedCount, 'transaction')}. Skipped ${formatCountLabel(skippedCount, 'row')}.`;
}

function formatBackupDetail(
  language: SettingsLanguage,
  {
    uploadedBalanceEntriesCount,
    uploadedBalanceTypesCount,
    uploadedCategoriesCount,
    uploadedSettingsCount,
    uploadedTransactionsCount,
  }: BackupResult,
) {
  return t(language, 'settings.backupSummaryDetail', {
    balanceEntries: t(
      language,
      uploadedBalanceEntriesCount === 1
        ? 'settings.backupBalanceEntryOne'
        : 'settings.backupBalanceEntryOther',
      { count: uploadedBalanceEntriesCount },
    ),
    balanceTypes: t(
      language,
      uploadedBalanceTypesCount === 1
        ? 'settings.backupBalanceTypeOne'
        : 'settings.backupBalanceTypeOther',
      { count: uploadedBalanceTypesCount },
    ),
    categories: t(
      language,
      uploadedCategoriesCount === 1
        ? 'settings.backupCategoryOne'
        : 'settings.backupCategoryOther',
      { count: uploadedCategoriesCount },
    ),
    settings: t(
      language,
      uploadedSettingsCount === 1
        ? 'settings.backupSettingOne'
        : 'settings.backupSettingOther',
      { count: uploadedSettingsCount },
    ),
    transactions: t(
      language,
      uploadedTransactionsCount === 1
        ? 'settings.backupTransactionOne'
        : 'settings.backupTransactionOther',
      { count: uploadedTransactionsCount },
    ),
  });
}

function formatRestoreResult({
  ignoredSettingsCount,
  restoredBalanceEntriesCount,
  restoredBalanceTypesCount,
  restoredCategoriesCount,
  restoredSettingsCount,
  restoredTransactionsCount,
}: RestoreUiResult) {
  return `Backup restored. ${formatCountLabel(restoredTransactionsCount, 'transaction')}, ${formatCountLabel(restoredCategoriesCount, 'category', 'categories')}, ${formatCountLabel(restoredBalanceTypesCount, 'balance type')}, ${formatCountLabel(restoredBalanceEntriesCount, 'balance entry', 'balance entries')}, and ${formatCountLabel(restoredSettingsCount, 'setting')} restored. Ignored ${formatCountLabel(ignoredSettingsCount, 'setting')}.`;
}

function formatSyncDetail(
  language: SettingsLanguage,
  {
    appliedCount,
    conflictsCount,
    ignoredCount,
    pulledCount,
    pushedCount,
  }: SyncUiResult,
) {
  return t(language, 'settings.syncSummaryDetail', {
    applied: appliedCount,
    conflicts: conflictsCount,
    ignored: ignoredCount,
    pulled: pulledCount,
    pushed: pushedCount,
  });
}

function formatLastBackup(timestamp: number) {
  const date = getValidDate(timestamp);

  return date ? `Last backup: ${timestampFormatter.format(date)}` : null;
}

function formatLastSync({
  source,
  timestamp,
}: {
  source: unknown;
  timestamp: number;
}) {
  const date = getValidDate(timestamp);
  const sourceLabel = getSafeSyncSourceLabel(source);

  if (!date) return null;

  return sourceLabel
    ? `Last sync: ${timestampFormatter.format(date)} - ${sourceLabel}`
    : `Last sync: ${timestampFormatter.format(date)}`;
}

function getSafeSyncCount(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
}

function getOptionalSafeSyncCount(value: unknown) {
  return value === undefined ? 0 : getSafeSyncCount(value);
}

function getSafeSyncTimestamp(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.trunc(value);
}

function getSafeSyncSource(value: unknown): SyncAttemptSource | null {
  return value === 'manual' || value === 'foreground' ? value : null;
}

function getSafeSyncSourceLabel(value: unknown) {
  const source = getSafeSyncSource(value);

  if (source === 'manual') return 'Manual';
  if (source === 'foreground') return 'Auto';

  return null;
}

function createSyncUiResult(
  result: Extract<SyncResult, { status: 'succeeded' }>,
) {
  return {
    appliedCount:
      result.appliedTransactionsCount +
      result.appliedCategoriesCount +
      result.appliedBalanceTypesCount +
      result.appliedBalanceEntriesCount +
      (result.appliedSettingsCount ?? 0),
    conflictsCount: result.conflictsCount,
    ignoredCount:
      result.ignoredTransactionTombstonesCount +
      result.ignoredCategoryTombstonesCount +
      result.ignoredBalanceTypeTombstonesCount +
      result.ignoredBalanceEntryTombstonesCount +
      (result.ignoredSettingsCount ?? 0),
    pulledCount:
      result.pulledTransactionsCount +
      result.pulledCategoriesCount +
      result.pulledBalanceTypesCount +
      result.pulledBalanceEntriesCount +
      (result.pulledSettingsCount ?? 0),
    pushedCount:
      result.pushedTransactionsCount +
      result.pushedCategoriesCount +
      result.pushedBalanceTypesCount +
      result.pushedBalanceEntriesCount +
      (result.pushedSettingsCount ?? 0),
  };
}

function createSyncUiResultFromSummary(
  summary: SyncSummary | Partial<SyncSummary> | null | undefined,
) {
  if (!summary || typeof summary !== 'object') return null;

  const pulledTransactionsCount = getSafeSyncCount(
    summary.pulledTransactionsCount,
  );
  const pulledCategoriesCount = getSafeSyncCount(summary.pulledCategoriesCount);
  const pulledBalanceTypesCount = getOptionalSafeSyncCount(
    summary.pulledBalanceTypesCount,
  );
  const pulledBalanceEntriesCount = getOptionalSafeSyncCount(
    summary.pulledBalanceEntriesCount,
  );
  const pulledSettingsCount = getOptionalSafeSyncCount(
    summary.pulledSettingsCount,
  );
  const pushedTransactionsCount = getSafeSyncCount(
    summary.pushedTransactionsCount,
  );
  const pushedCategoriesCount = getSafeSyncCount(summary.pushedCategoriesCount);
  const pushedBalanceTypesCount = getOptionalSafeSyncCount(
    summary.pushedBalanceTypesCount,
  );
  const pushedBalanceEntriesCount = getOptionalSafeSyncCount(
    summary.pushedBalanceEntriesCount,
  );
  const pushedSettingsCount = getOptionalSafeSyncCount(
    summary.pushedSettingsCount,
  );
  const appliedTransactionsCount = getSafeSyncCount(
    summary.appliedTransactionsCount,
  );
  const appliedCategoriesCount = getSafeSyncCount(
    summary.appliedCategoriesCount,
  );
  const appliedBalanceTypesCount = getOptionalSafeSyncCount(
    summary.appliedBalanceTypesCount,
  );
  const appliedBalanceEntriesCount = getOptionalSafeSyncCount(
    summary.appliedBalanceEntriesCount,
  );
  const appliedSettingsCount = getOptionalSafeSyncCount(
    summary.appliedSettingsCount,
  );
  const conflictsCount = getSafeSyncCount(summary.conflictsCount);
  const ignoredTransactionTombstonesCount = getSafeSyncCount(
    summary.ignoredTransactionTombstonesCount,
  );
  const ignoredCategoryTombstonesCount = getSafeSyncCount(
    summary.ignoredCategoryTombstonesCount,
  );
  const ignoredBalanceTypeTombstonesCount = getOptionalSafeSyncCount(
    summary.ignoredBalanceTypeTombstonesCount,
  );
  const ignoredBalanceEntryTombstonesCount = getOptionalSafeSyncCount(
    summary.ignoredBalanceEntryTombstonesCount,
  );
  const ignoredSettingsCount = getOptionalSafeSyncCount(
    summary.ignoredSettingsCount,
  );

  if (
    pulledTransactionsCount === null ||
    pulledCategoriesCount === null ||
    pulledBalanceTypesCount === null ||
    pulledBalanceEntriesCount === null ||
    pulledSettingsCount === null ||
    pushedTransactionsCount === null ||
    pushedCategoriesCount === null ||
    pushedBalanceTypesCount === null ||
    pushedBalanceEntriesCount === null ||
    pushedSettingsCount === null ||
    appliedTransactionsCount === null ||
    appliedCategoriesCount === null ||
    appliedBalanceTypesCount === null ||
    appliedBalanceEntriesCount === null ||
    appliedSettingsCount === null ||
    conflictsCount === null ||
    ignoredTransactionTombstonesCount === null ||
    ignoredCategoryTombstonesCount === null ||
    ignoredBalanceTypeTombstonesCount === null ||
    ignoredBalanceEntryTombstonesCount === null ||
    ignoredSettingsCount === null
  ) {
    return null;
  }

  return {
    appliedCount:
      appliedTransactionsCount +
      appliedCategoriesCount +
      appliedBalanceTypesCount +
      appliedBalanceEntriesCount +
      appliedSettingsCount,
    conflictsCount,
    ignoredCount:
      ignoredTransactionTombstonesCount +
      ignoredCategoryTombstonesCount +
      ignoredBalanceTypeTombstonesCount +
      ignoredBalanceEntryTombstonesCount +
      ignoredSettingsCount,
    pulledCount:
      pulledTransactionsCount +
      pulledCategoriesCount +
      pulledBalanceTypesCount +
      pulledBalanceEntriesCount +
      pulledSettingsCount,
    pushedCount:
      pushedTransactionsCount +
      pushedCategoriesCount +
      pushedBalanceTypesCount +
      pushedBalanceEntriesCount +
      pushedSettingsCount,
  };
}

function getAccountDisplayName(user: AuthUser) {
  if (user.email) return user.email;
  if (user.displayName) return user.displayName;

  return user.provider === 'apple' ? 'Apple account' : 'Google account';
}

function SafeSymbol({
  fallbackLabel,
  name,
  size = 17,
  tintColor,
}: {
  fallbackLabel: string;
  name: SFSymbol;
  size?: number;
  tintColor: string;
}) {
  return (
    <SymbolView
      fallback={
        <Text style={[styles.symbolFallback, { color: tintColor }]}>
          {fallbackLabel}
        </Text>
      }
      name={name}
      resizeMode="scaleAspectFit"
      size={size}
      tintColor={tintColor}
      type="monochrome"
      weight="semibold"
    />
  );
}

function SettingsInfoDisclosure({
  detail,
  expanded,
  onPress,
  title,
}: {
  detail: string;
  expanded: boolean;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable
      accessibilityLabel={title}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={styles.infoDisclosure}
    >
      <SafeSymbol
        fallbackLabel="i"
        name="info.circle"
        size={17}
        tintColor="#000000"
      />

      <View style={styles.infoDisclosureCopy}>
        <Text style={styles.infoDisclosureTitle}>{title}</Text>

        {expanded ? (
          <Text style={styles.infoDisclosureDetail}>{detail}</Text>
        ) : null}
      </View>

      <SafeSymbol
        fallbackLabel={expanded ? '⌃' : '⌄'}
        name={expanded ? 'chevron.up' : 'chevron.down'}
        size={17}
        tintColor="#007aff"
      />
    </Pressable>
  );
}

function SettingsRow({
  disabled = false,
  onPress,
  subtitle,
  testID,
  title,
  trailing,
}: {
  disabled?: boolean;
  onPress?: () => void;
  subtitle?: string;
  testID?: string;
  title: string;
  trailing?: ReactNode;
}) {
  const content = (
    <>
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={styles.rowTitle}>
          {title}
        </Text>

        {subtitle ? (
          <Text numberOfLines={2} style={styles.rowSubtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing ? <View style={styles.rowTrailing}>{trailing}</View> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={[
          styles.settingsRow,
          subtitle ? styles.settingsRowTall : null,
          disabled ? styles.disabled : null,
        ]}
        testID={testID}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.settingsRow,
        subtitle ? styles.settingsRowTall : null,
        disabled ? styles.disabled : null,
      ]}
      testID={testID}
    >
      {content}
    </View>
  );
}

function ActionText({
  children,
  destructive = false,
  disabled = false,
  icon,
}: {
  children: string;
  destructive?: boolean;
  disabled?: boolean;
  icon?: SFSymbol;
}) {
  const color = destructive ? '#ff383c' : '#0088ff';

  return (
    <View style={[styles.actionTextWrap, disabled ? styles.disabled : null]}>
      {icon ? (
        <SafeSymbol
          fallbackLabel="Open"
          name={icon}
          size={15}
          tintColor={color}
        />
      ) : null}
      <Text style={[styles.actionText, { color }]}>{children}</Text>
    </View>
  );
}

function CategoryIcon({ category }: { category: Category }) {
  const icon = getCategoryIcon(category.iconName);

  return (
    <SymbolView
      fallback={
        <Text style={styles.categoryIconFallback}>{icon.fallbackSymbol}</Text>
      }
      name={icon.symbolName}
      resizeMode="scaleAspectFit"
      size={16}
      testID={`settings-category-icon-${category.id}`}
      tintColor="#100f10"
      type="monochrome"
      weight="semibold"
    />
  );
}

type SwipeCategoryRowProps = {
  category: Category;
  isDeleteDisabled: boolean;
  isDisabled: boolean;
  isOpen: boolean;
  language: SettingsLanguage;
  onDelete: (category: Category) => void;
  onEdit: (category: Category) => void;
  onSwipeClose: (id: string) => void;
  onSwipeInteractionStart: (id: string) => void;
  onSwipeOpen: (id: string) => void;
};

function SwipeCategoryRow({
  category,
  isDeleteDisabled,
  isDisabled,
  isOpen,
  language,
  onDelete,
  onEdit,
  onSwipeClose,
  onSwipeInteractionStart,
  onSwipeOpen,
}: SwipeCategoryRowProps) {
  const swipeProgress = useRef(new Animated.Value(0)).current;
  const isHorizontallyLockedRef = useRef(false);
  const [rowWidth, setRowWidth] = useState(360);
  const actionRevealWidth = Math.min(CATEGORY_SWIPE_REVEAL_WIDTH, rowWidth);

  const animateTo = useCallback(
    (toValue: number) => {
      Animated.spring(swipeProgress, {
        toValue,
        damping: 22,
        mass: 0.72,
        stiffness: 260,
        useNativeDriver: false,
      }).start();
    },
    [swipeProgress],
  );

  const closeActions = useCallback(() => {
    animateTo(0);
    onSwipeClose(category.id);
  }, [animateTo, category.id, onSwipeClose]);

  const revealDelete = useCallback(() => {
    if (isDeleteDisabled) {
      closeActions();

      return;
    }

    onSwipeOpen(category.id);
    animateTo(1);
  }, [animateTo, category.id, closeActions, isDeleteDisabled, onSwipeOpen]);

  const revealEdit = useCallback(() => {
    onSwipeOpen(category.id);
    animateTo(-1);
  }, [animateTo, category.id, onSwipeOpen]);

  const handleTouchStart = useCallback(() => {
    if (isDisabled) return;

    onSwipeInteractionStart(category.id);
  }, [category.id, isDisabled, onSwipeInteractionStart]);

  const handleDeletePress = useCallback(() => {
    if (isDisabled || isDeleteDisabled) return;

    closeActions();
    onDelete(category);
  }, [category, closeActions, isDeleteDisabled, isDisabled, onDelete]);

  const handleEditPress = useCallback(() => {
    if (isDisabled) return;

    closeActions();
    onEdit(category);
  }, [category, closeActions, isDisabled, onEdit]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) => {
          if (isDisabled) return false;

          const shouldLockSwipe = hasHorizontalSwipeIntent(gestureState);
          isHorizontallyLockedRef.current = shouldLockSwipe;

          return shouldLockSwipe;
        },
        onMoveShouldSetPanResponderCapture: (_event, gestureState) => {
          if (isDisabled) return false;

          const shouldLockSwipe = hasHorizontalSwipeIntent(gestureState);
          isHorizontallyLockedRef.current = shouldLockSwipe;

          return shouldLockSwipe;
        },
        onPanResponderGrant: () => {
          onSwipeInteractionStart(category.id);
          swipeProgress.stopAnimation();
        },
        onPanResponderMove: (_event, gestureState) => {
          if (isDisabled || !isHorizontallyLockedRef.current) return;

          swipeProgress.setValue(clampCategorySwipeProgress(gestureState.dx));
        },
        onPanResponderRelease: (_event, gestureState) => {
          const wasHorizontallyLocked = isHorizontallyLockedRef.current;
          isHorizontallyLockedRef.current = false;

          if (!wasHorizontallyLocked) {
            closeActions();

            return;
          }

          if (
            gestureState.dx > SWIPE_OPEN_THRESHOLD ||
            gestureState.vx > SWIPE_VELOCITY_THRESHOLD
          ) {
            revealDelete();

            return;
          }

          if (
            gestureState.dx < -SWIPE_OPEN_THRESHOLD ||
            gestureState.vx < -SWIPE_VELOCITY_THRESHOLD
          ) {
            revealEdit();

            return;
          }

          closeActions();
        },
        onPanResponderTerminationRequest: () =>
          !isHorizontallyLockedRef.current,
        onPanResponderTerminate: () => {
          isHorizontallyLockedRef.current = false;
          closeActions();
        },
      }),
    [
      category.id,
      closeActions,
      isDisabled,
      onSwipeInteractionStart,
      revealDelete,
      revealEdit,
      swipeProgress,
    ],
  );

  useEffect(() => {
    if (isDisabled) closeActions();
  }, [closeActions, isDisabled]);

  useEffect(() => {
    if (isOpen) return;

    animateTo(0);
  }, [animateTo, isOpen]);

  const leftActionWidth = swipeProgress.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0, 0, actionRevealWidth],
  });
  const rightActionWidth = swipeProgress.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [actionRevealWidth, 0, 0],
  });
  const contentWidth = swipeProgress.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [
      rowWidth - actionRevealWidth,
      rowWidth,
      rowWidth - actionRevealWidth,
    ],
  });
  const contentBackgroundColor = swipeProgress.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['#ffffff', '#f7f7f5', '#ffffff'],
  });
  const contentLeftRadius = swipeProgress.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0, 26, 24],
  });
  const contentRightRadius = swipeProgress.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [24, 26, 0],
  });
  const leftActionOpacity = swipeProgress.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0, 0, 1],
  });
  const rightActionOpacity = swipeProgress.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [1, 0, 0],
  });

  return (
    <View
      onLayout={(event) => {
        setRowWidth(event.nativeEvent.layout.width);
      }}
      style={styles.categorySwipeContainer}
    >
      <Animated.View
        style={[
          styles.categorySwipeActionSlot,
          { opacity: leftActionOpacity, width: leftActionWidth },
        ]}
      >
        <Pressable
          accessibilityLabel={`Delete ${category.name} category`}
          accessibilityRole="button"
          disabled={isDisabled || isDeleteDisabled}
          onPress={handleDeletePress}
          style={[
            styles.categorySwipeActionCircle,
            styles.categoryDeleteAction,
            isDeleteDisabled ? styles.disabled : null,
          ]}
        >
          <SafeSymbol
            fallbackLabel="Del"
            name="trash.fill"
            size={18}
            tintColor="#ffffff"
          />
        </Pressable>
      </Animated.View>

      <Animated.View
        {...panResponder.panHandlers}
        onTouchStart={handleTouchStart}
        style={[
          styles.categoryPill,
          {
            backgroundColor: contentBackgroundColor,
            borderBottomLeftRadius: contentLeftRadius,
            borderBottomRightRadius: contentRightRadius,
            borderTopLeftRadius: contentLeftRadius,
            borderTopRightRadius: contentRightRadius,
            width: contentWidth,
          },
        ]}
        testID={`settings-category-row-${category.id}`}
      >
        <CategoryIcon category={category} />
        <Text numberOfLines={1} style={styles.categoryName}>
          {category.isDefault
            ? (getDefaultCategoryName(language, category.id) ?? category.name)
            : category.name}
        </Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.categorySwipeActionSlot,
          styles.categorySwipeActionSlotTrailing,
          { opacity: rightActionOpacity, width: rightActionWidth },
        ]}
      >
        <Pressable
          accessibilityLabel={`Edit ${category.name} category`}
          accessibilityRole="button"
          disabled={isDisabled}
          onPress={handleEditPress}
          style={[styles.categorySwipeActionCircle, styles.categoryEditAction]}
        >
          <SafeSymbol
            fallbackLabel="Edit"
            name="pencil"
            size={18}
            tintColor="#ffffff"
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

function OptionSheet({
  draftCurrency,
  draftLanguage,
  language,
  onApply,
  onClose,
  onSelectCurrency,
  onSelectLanguage,
  sheet,
}: {
  draftCurrency: SettingsCurrency;
  draftLanguage: SettingsLanguage;
  language: SettingsLanguage;
  onApply: () => void;
  onClose: () => void;
  onSelectCurrency: (currency: SettingsCurrency) => void;
  onSelectLanguage: (language: SettingsLanguage) => void;
  sheet: SettingsOptionSheet | null;
}) {
  if (!sheet) return null;

  const options =
    sheet.kind === 'currency'
      ? SETTINGS_CURRENCY_OPTIONS.map((option) => ({
          key: option,
          label: getCurrencyOptionLabel(option),
          selected: draftCurrency === option,
          onPress: () => onSelectCurrency(option),
        }))
      : SETTINGS_LANGUAGE_OPTIONS.map((option) => ({
          key: option,
          label: option,
          selected: draftLanguage === option,
          onPress: () => onSelectLanguage(option),
        }));

  return (
    <Modal animationType="slide" transparent visible onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <View style={styles.sheetHeader}>
            <Pressable
              accessibilityLabel={t(language, 'settings.closeSheet')}
              accessibilityRole="button"
              onPress={onClose}
              style={[styles.sheetCircleButton, styles.sheetCloseButton]}
            >
              <SafeSymbol fallbackLabel="x" name="xmark" tintColor="#727272" />
            </Pressable>

            <Text style={styles.sheetTitle}>{sheet.title}</Text>

            <Pressable
              accessibilityLabel={t(language, 'settings.applySelection')}
              accessibilityRole="button"
              onPress={onApply}
              style={[styles.sheetCircleButton, styles.sheetApplyButton]}
            >
              <SafeSymbol
                fallbackLabel="OK"
                name="checkmark"
                tintColor="#ffffff"
              />
            </Pressable>
          </View>

          <View style={styles.sheetList}>
            {options.map((option, index) => (
              <Pressable
                accessibilityRole="button"
                key={option.key}
                onPress={option.onPress}
                style={styles.sheetOptionRow}
                testID={`settings-${sheet.kind}-option-${option.key}`}
              >
                <View style={styles.sheetCheckSlot}>
                  {option.selected ? (
                    <View style={styles.sheetSelectedCircle}>
                      <SafeSymbol
                        fallbackLabel="OK"
                        name="checkmark"
                        size={14}
                        tintColor="#ffffff"
                      />
                    </View>
                  ) : null}
                </View>

                <View style={styles.sheetOptionContent}>
                  {index > 0 ? <View style={styles.sheetSeparator} /> : null}
                  <Text style={styles.sheetOptionText}>{option.label}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function SettingsScreen() {
  const authStatus = useAuthStore((state) => state.status);
  const authUser = useAuthStore((state) => state.user);
  const authError = useAuthStore((state) => state.error);
  const setAuthSession = useAuthStore((state) => state.setSession);
  const signOut = useAuthStore((state) => state.signOut);
  const clearAuthError = useAuthStore((state) => state.clearAuthError);

  const transactions = useTransactionsStore((state) => state.transactions);
  const isTransactionsLoading = useTransactionsStore(
    (state) => state.isLoading,
  );
  const transactionsError = useTransactionsStore((state) => state.error);
  const isTransactionsInitialized = useTransactionsStore(
    (state) => state.isInitialized,
  );
  const loadTransactions = useTransactionsStore(
    (state) => state.loadTransactions,
  );
  const importTransactions = useTransactionsStore(
    (state) => state.importTransactions,
  );
  const clearTransactionsError = useTransactionsStore(
    (state) => state.clearError,
  );

  const isBalanceInitialized = useBalanceStore((state) => state.isInitialized);
  const loadBalance = useBalanceStore((state) => state.loadBalance);

  const categories = useCategoriesStore((state) => state.categories);
  const activeCategories = useCategoriesStore(
    (state) => state.activeCategories,
  );
  const isCategoriesLoading = useCategoriesStore((state) => state.isLoading);
  const isCategoriesInitialized = useCategoriesStore(
    (state) => state.isInitialized,
  );
  const categoriesError = useCategoriesStore((state) => state.error);
  const loadCategories = useCategoriesStore((state) => state.loadCategories);
  const addCategory = useCategoriesStore((state) => state.addCategory);
  const updateCategory = useCategoriesStore((state) => state.updateCategory);
  const archiveCategory = useCategoriesStore((state) => state.archiveCategory);
  const clearCategoriesError = useCategoriesStore((state) => state.clearError);

  const [isReminderEnabled, setIsReminderEnabled] = useState(false);
  const [isReminderLoading, setIsReminderLoading] = useState(true);
  const [isReminderBusy, setIsReminderBusy] = useState(false);
  const [reminderPermissionStatus, setReminderPermissionStatus] =
    useState<ReminderPermissionStatus>('undetermined');
  const [reminderError, setReminderError] = useState<string | null>(null);

  const [currency, setCurrency] = useState<SettingsCurrency>(
    DEFAULT_SETTINGS_CURRENCY,
  );
  const [language, setLanguage] = useState<SettingsLanguage>(
    DEFAULT_SETTINGS_LANGUAGE,
  );
  const [draftCurrency, setDraftCurrency] = useState<SettingsCurrency>(
    DEFAULT_SETTINGS_CURRENCY,
  );
  const [draftLanguage, setDraftLanguage] = useState<SettingsLanguage>(
    DEFAULT_SETTINGS_LANGUAGE,
  );
  const [sheet, setSheet] = useState<SettingsOptionSheet | null>(null);
  const [isForegroundSyncEnabled, setIsForegroundSyncEnabledState] =
    useState<boolean>(featureFlags.incrementalSyncEnabled);
  const [isSyncPreferenceBusy, setIsSyncPreferenceBusy] = useState(true);
  const [syncPreferenceError, setSyncPreferenceError] = useState<string | null>(
    null,
  );

  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(
    null,
  );
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupResult, setBackupResult] = useState<BackupResult | null>(null);
  const [isBackupSummaryExpanded, setIsBackupSummaryExpanded] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreUiResult | null>(
    null,
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncUiResult | null>(null);
  const [isSyncSummaryExpanded, setIsSyncSummaryExpanded] = useState(false);
  const [persistedSyncResult, setPersistedSyncResult] =
    useState<SyncUiResult | null>(null);
  const [isRestoreEmpty, setIsRestoreEmpty] = useState(false);
  const [lastSuccessfulBackupAt, setLastSuccessfulBackupAtState] = useState<
    number | null
  >(null);
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAtState] = useState<
    number | null
  >(null);
  const [lastSuccessfulSyncSource, setLastSuccessfulSyncSourceState] =
    useState<SyncAttemptSource | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [externalLinkError, setExternalLinkError] = useState<string | null>(
    null,
  );

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIconName, setNewCategoryIconName] =
    useState<CategoryIconName | null>(null);
  const [isAddIconPickerExpanded, setIsAddIconPickerExpanded] = useState(false);
  const [addCategoryError, setAddCategoryError] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [editingName, setEditingName] = useState('');
  const [editingIconName, setEditingIconName] =
    useState<CategoryIconName | null>(null);
  const [isEditIconPickerExpanded, setIsEditIconPickerExpanded] =
    useState(false);
  const [editCategoryError, setEditCategoryError] = useState<string | null>(
    null,
  );
  const [archiveCategoryError, setArchiveCategoryError] = useState<
    string | null
  >(null);
  const [openSwipeCategoryId, setOpenSwipeCategoryId] = useState<string | null>(
    null,
  );

  const isSyncInFlightRef = useRef(false);

  const isReminderUnsupported = reminderPermissionStatus === 'unsupported';
  const isImportUnsupported = Platform.OS === 'web';
  const isAuthenticated = authStatus === 'authenticated' && authUser !== null;
  const isGoogleAuthAvailable =
    featureFlags.googleAuthEnabled && googleAuthAdapter.isEnabled;
  const shouldCheckAppleAuthAvailability =
    featureFlags.appleAuthEnabled &&
    appleAuthAdapter.isEnabled &&
    Platform.OS === 'ios';
  const shouldShowAppleAuth =
    shouldCheckAppleAuthAvailability && isAppleAuthAvailable;
  const shouldShowBackup = featureFlags.backupEnabled && isAuthenticated;
  const shouldShowRestore = featureFlags.restoreEnabled && isAuthenticated;
  const shouldShowSync = featureFlags.incrementalSyncEnabled && isAuthenticated;
  const isReminderDisabled =
    isReminderLoading || isReminderBusy || isReminderUnsupported;
  const isGoogleAuthDisabled = isAuthBusy || authStatus === 'loading';
  const isAppleAuthDisabled = isAuthBusy || authStatus === 'loading';
  const isSignOutDisabled =
    isAuthBusy || isDeletingAccount || authStatus === 'loading';
  const isDeleteAccountDisabled =
    isDeletingAccount || isAuthBusy || authStatus === 'loading';
  const isSyncToggleDisabled =
    isSyncPreferenceBusy || !featureFlags.incrementalSyncEnabled;
  const isDataActionBusy = isExporting || isImporting;
  const isDataPreparing =
    !isTransactionsInitialized || isTransactionsLoading || isDataActionBusy;
  const isExportDisabled = isDataPreparing || transactionsError !== null;
  const isImportDisabled = isDataPreparing || isImportUnsupported;
  const isBackupDisabled = isBackingUp || !shouldShowBackup;
  const isRestoreDisabled = isRestoring || !shouldShowRestore;
  const isSyncDisabled = isSyncing || !shouldShowSync;
  const shouldShowTransactionsError =
    transactionsError !== null && transactionsError !== importError;
  const visibleSyncResult = syncResult ?? persistedSyncResult;
  const lastBackupText =
    lastSuccessfulBackupAt === null
      ? null
      : formatLastBackup(lastSuccessfulBackupAt);
  const lastSyncText =
    lastSuccessfulSyncAt === null
      ? null
      : formatLastSync({
          source: lastSuccessfulSyncSource,
          timestamp: lastSuccessfulSyncAt,
        });

  useTransactionsRefresh({
    isInitialized: isTransactionsInitialized,
    loadTransactions,
  });
  useCategoriesRefresh({
    isInitialized: isCategoriesInitialized,
    loadCategories,
    loadOnMount: 'always',
  });
  useBalanceRefresh({
    isInitialized: isBalanceInitialized,
    loadBalance,
  });

  useEffect(() => {
    if (!openSwipeCategoryId) return;

    const isOpenCategoryVisible = activeCategories.some(
      (category) => category.id === openSwipeCategoryId,
    );

    if (isOpenCategoryVisible) return;

    setOpenSwipeCategoryId(null);
  }, [activeCategories, openSwipeCategoryId]);

  useEffect(() => {
    if (!isCategoriesLoading && !isAddingCategory && !editingCategoryId) return;

    setOpenSwipeCategoryId(null);
  }, [editingCategoryId, isAddingCategory, isCategoriesLoading]);

  const handleCategorySwipeInteractionStart = useCallback((id: string) => {
    setOpenSwipeCategoryId((currentId) =>
      currentId === id ? currentId : null,
    );
  }, []);

  const handleCategorySwipeOpen = useCallback((id: string) => {
    setOpenSwipeCategoryId(id);
  }, []);

  const handleCategorySwipeClose = useCallback((id: string) => {
    setOpenSwipeCategoryId((currentId) =>
      currentId === id ? null : currentId,
    );
  }, []);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const [storedReminderEnabled, permissionStatus] = await Promise.all([
          getReminderEnabled(),
          getReminderPermissionStatus(),
        ]);

        if (!isMounted) return;

        setIsReminderEnabled(
          permissionStatus === 'unsupported' ? false : storedReminderEnabled,
        );
        setReminderPermissionStatus(permissionStatus);
      } catch {
        console.error('Failed to load reminder settings');

        if (!isMounted) return;

        setIsReminderEnabled(false);
        setReminderError("Couldn't load reminder settings. Try again.");
      } finally {
        if (isMounted) setIsReminderLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const [storedCurrency, storedLanguage, storedForegroundSyncEnabled] =
          await Promise.all([
            getSettingsCurrency(),
            getSettingsLanguage(),
            getForegroundSyncEnabled(),
          ]);

        if (!isMounted) return;

        setCurrency(storedCurrency);
        setDraftCurrency(storedCurrency);
        setLanguage(storedLanguage);
        setDraftLanguage(storedLanguage);
        setIsForegroundSyncEnabledState(
          featureFlags.incrementalSyncEnabled && storedForegroundSyncEnabled,
        );
      } catch {
        if (!isMounted) return;

        setCurrency(DEFAULT_SETTINGS_CURRENCY);
        setLanguage(DEFAULT_SETTINGS_LANGUAGE);
        setIsForegroundSyncEnabledState(featureFlags.incrementalSyncEnabled);
      } finally {
        if (isMounted) setIsSyncPreferenceBusy(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!featureFlags.backupEnabled) return;

    let isMounted = true;

    void (async () => {
      try {
        const timestamp = await getLastSuccessfulBackupAt();

        if (isMounted) setLastSuccessfulBackupAtState(timestamp);
      } catch {
        if (isMounted) setLastSuccessfulBackupAtState(null);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!shouldShowSync) {
      setLastSuccessfulSyncAtState(null);
      setLastSuccessfulSyncSourceState(null);
      setPersistedSyncResult(null);
      setIsSyncSummaryExpanded(false);

      return;
    }

    let isMounted = true;

    void (async () => {
      try {
        const metadata = await getSyncMetadata();

        if (!isMounted) return;

        setLastSuccessfulSyncAtState(
          getSafeSyncTimestamp(metadata.lastSyncSummary?.completedAt) ??
            getSafeSyncTimestamp(metadata.lastSuccessfulSyncAt),
        );
        setLastSuccessfulSyncSourceState(
          getSafeSyncSource(metadata.lastSuccessfulSyncSource),
        );
        setIsSyncSummaryExpanded(false);
        setPersistedSyncResult(
          createSyncUiResultFromSummary(metadata.lastSyncSummary),
        );
      } catch {
        if (!isMounted) return;

        setLastSuccessfulSyncAtState(null);
        setLastSuccessfulSyncSourceState(null);
        setPersistedSyncResult(null);
        setIsSyncSummaryExpanded(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [shouldShowSync]);

  useEffect(() => {
    if (!shouldCheckAppleAuthAvailability) {
      setIsAppleAuthAvailable(false);

      return;
    }

    let isMounted = true;

    void appleAuthAdapter
      .isAvailable()
      .then((isAvailable) => {
        if (isMounted) setIsAppleAuthAvailable(isAvailable);
      })
      .catch(() => {
        if (isMounted) setIsAppleAuthAvailable(false);
      });

    return () => {
      isMounted = false;
    };
  }, [shouldCheckAppleAuthAvailability]);

  async function handleReminderToggle(nextEnabled: boolean) {
    if (isReminderDisabled) return;

    const previousEnabled = isReminderEnabled;

    setIsReminderBusy(true);
    setReminderError(null);
    setIsReminderEnabled(nextEnabled);

    try {
      if (nextEnabled) {
        const permissionStatus = await requestReminderPermissions();

        setReminderPermissionStatus(permissionStatus);

        if (permissionStatus !== 'granted') {
          await cancelDailyCheckInReminder();
          await setReminderEnabled(false);
          setIsReminderEnabled(false);
          setReminderError(getReminderPermissionError(permissionStatus));

          return;
        }

        await scheduleDailyCheckInReminder();
        await setReminderEnabled(true);
        setIsReminderEnabled(true);

        return;
      }

      await cancelDailyCheckInReminder();
      await setReminderEnabled(false);
      setIsReminderEnabled(false);
    } catch {
      console.error('Failed to update reminder preference');
      setIsReminderEnabled(previousEnabled);
      setReminderError(
        nextEnabled
          ? "Couldn't turn on the daily reminder. Try again."
          : "Couldn't turn off the daily reminder. Try again.",
      );
    } finally {
      setIsReminderBusy(false);
    }
  }

  async function handleForegroundSyncToggle(nextEnabled: boolean) {
    if (isSyncToggleDisabled) return;

    const previousEnabled = isForegroundSyncEnabled;

    setIsForegroundSyncEnabledState(nextEnabled);
    setSyncPreferenceError(null);
    setIsSyncPreferenceBusy(true);

    try {
      await setForegroundSyncEnabled(nextEnabled);
    } catch {
      setIsForegroundSyncEnabledState(previousEnabled);
      setSyncPreferenceError("Couldn't update synchronization. Try again.");
    } finally {
      setIsSyncPreferenceBusy(false);
    }
  }

  async function handleApplySheet() {
    if (!sheet) return;

    try {
      if (sheet.kind === 'currency') {
        await setSettingsCurrency(draftCurrency);
        setCurrency(draftCurrency);
        notifySettingsCurrencyChanged(draftCurrency);
      } else {
        await setSettingsLanguage(draftLanguage);
        setLanguage(draftLanguage);
        notifySettingsLanguageChanged(draftLanguage);
      }

      setSheet(null);
    } catch {
      setSheet(null);
    }
  }

  function handleCloseSheet() {
    setDraftCurrency(currency);
    setDraftLanguage(language);
    setSheet(null);
  }

  async function refreshSettingsPreferences() {
    const [storedCurrency, storedLanguage] = await Promise.all([
      getSettingsCurrency(),
      getSettingsLanguage(),
    ]);

    setCurrency(storedCurrency);
    setDraftCurrency(storedCurrency);
    setLanguage(storedLanguage);
    setDraftLanguage(storedLanguage);
    notifySettingsCurrencyChanged(storedCurrency);
    notifySettingsLanguageChanged(storedLanguage);
  }

  async function handleGoogleSignInPress() {
    if (isGoogleAuthDisabled || !isGoogleAuthAvailable) return;

    setIsAuthBusy(true);
    setAccountError(null);
    clearAuthError();

    try {
      const session = await googleAuthAdapter.signIn();

      if (session) await setAuthSession(session);
    } catch (error) {
      console.error('Failed to sign in with Google');
      setAccountError(getGoogleAuthSafeErrorMessage(error));
    } finally {
      setIsAuthBusy(false);
    }
  }

  async function handleAppleSignInPress() {
    if (isAppleAuthDisabled || !shouldShowAppleAuth) return;

    setIsAuthBusy(true);
    setAccountError(null);
    clearAuthError();

    try {
      const session = await appleAuthAdapter.signIn();

      if (session) await setAuthSession(session);
    } catch (error) {
      setAccountError(getAppleAuthSafeErrorMessage(error));
    } finally {
      setIsAuthBusy(false);
    }
  }

  async function handleSignOutPress() {
    if (isSignOutDisabled) return;

    setIsAuthBusy(true);
    setAccountError(null);
    clearAuthError();

    try {
      await signOut();
    } catch {
      console.error('Failed to sign out');
      setAccountError('Could not sign out. Try again.');
    } finally {
      setIsAuthBusy(false);
    }
  }

  function handleDeleteAccountPress() {
    if (isDeleteAccountDisabled || !isAuthenticated) return;

    Alert.alert(
      t(language, 'settings.deleteAccountTitle'),
      t(language, 'settings.deleteAccountMessage'),
      [
        { text: t(language, 'common.cancel'), style: 'cancel' },
        {
          text: t(language, 'settings.deleteAccountConfirm'),
          style: 'destructive',
          onPress: () => {
            void handleConfirmedDeleteAccount();
          },
        },
      ],
    );
  }

  async function handleConfirmedDeleteAccount() {
    if (isDeleteAccountDisabled || !isAuthenticated) return;

    setIsDeletingAccount(true);
    setDeleteAccountError(null);
    setAccountError(null);
    clearAuthError();

    try {
      const result = await deleteAccountService.runDeleteAccount({
        auth: {
          status: authStatus,
          hasAuthenticatedUser: authUser !== null,
        },
      });

      if (result.status !== 'succeeded') {
        setDeleteAccountError("Couldn't delete account. Try again.");

        return;
      }

      await signOut();
    } catch {
      console.error('Failed to delete account data');
      setDeleteAccountError("Couldn't delete account. Try again.");
    } finally {
      setIsDeletingAccount(false);
    }
  }

  async function handleImportPress() {
    if (isImportDisabled) return;

    setIsImporting(true);
    setImportResult(null);
    setImportError(null);

    try {
      const selection = await pickTransactionsCsvImport();

      if (selection.status === 'cancelled') return;

      const { transactions: importedTransactions, skippedCount } = selection;
      let importedCount = 0;

      clearTransactionsError();

      if (importedTransactions.length > 0) {
        importedCount = await importTransactions(importedTransactions);

        const storeError = useTransactionsStore.getState().error;

        if (storeError) {
          setImportResult(null);
          setImportError(storeError);

          return;
        }
      }

      setImportResult({
        importedCount,
        skippedCount:
          skippedCount + (importedTransactions.length - importedCount),
      });
      setImportError(null);
    } catch {
      console.error('Failed to import transactions CSV');
      setImportResult(null);
      setImportError("Couldn't import CSV. Try again.");
    } finally {
      setIsImporting(false);
    }
  }

  async function handleExportPress() {
    if (isExportDisabled) return;

    setIsExporting(true);
    setExportError(null);

    try {
      await exportTransactionsCsv(transactions);
    } catch {
      console.error('Failed to export transactions CSV');
      setExportError("Couldn't export transactions. Try again.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleBackupPress() {
    if (isBackupDisabled) return;

    setIsBackingUp(true);
    setBackupError(null);
    setBackupResult(null);
    setIsBackupSummaryExpanded(false);

    try {
      const result = await manualBackupService.runBackup({
        auth: {
          status: authStatus,
          userId: authUser?.id,
        },
      });

      if (result.status !== 'succeeded') {
        setBackupError("Couldn't create backup. Try again.");

        return;
      }

      const completedAt = Date.now();

      try {
        await setLastSuccessfulBackupAt(completedAt);
        setLastSuccessfulBackupAtState(completedAt);
      } catch {
        setLastSuccessfulBackupAtState(null);
      }

      setBackupResult({
        uploadedTransactionsCount: result.uploadedTransactionsCount,
        uploadedCategoriesCount: result.uploadedCategoriesCount,
        uploadedBalanceTypesCount: result.uploadedBalanceTypesCount,
        uploadedBalanceEntriesCount: result.uploadedBalanceEntriesCount,
        uploadedSettingsCount: result.uploadedSettingsCount ?? 0,
      });
      setIsBackupSummaryExpanded(false);
    } catch {
      setBackupError("Couldn't create backup. Try again.");
    } finally {
      setIsBackingUp(false);
    }
  }

  async function confirmRestoreIfLocalDataExists() {
    const hasLocalData = await manualRestoreService.hasLocalData();

    if (!hasLocalData) return true;

    return new Promise<boolean>((resolve) => {
      Alert.alert(
        t(language, 'settings.restoreTitle'),
        t(language, 'settings.restoreMessage'),
        [
          {
            text: t(language, 'common.cancel'),
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: t(language, 'settings.restoreConfirm'),
            onPress: () => resolve(true),
          },
        ],
      );
    });
  }

  async function handleRestorePress() {
    if (isRestoreDisabled) return;

    setRestoreError(null);
    setRestoreResult(null);
    setIsRestoreEmpty(false);

    let shouldRestore = false;

    try {
      shouldRestore = await confirmRestoreIfLocalDataExists();
    } catch {
      setRestoreError("Couldn't restore backup. Try again.");

      return;
    }

    if (!shouldRestore) return;

    setIsRestoring(true);

    try {
      const result = await manualRestoreService.runRestore({
        auth: {
          status: authStatus,
          userId: authUser?.id,
        },
      });

      if (result.status === 'empty') {
        setIsRestoreEmpty(true);

        return;
      }

      if (result.status !== 'succeeded') {
        setRestoreError("Couldn't restore backup. Try again.");

        return;
      }

      setRestoreResult({
        restoredTransactionsCount: result.restoredTransactionsCount,
        restoredCategoriesCount: result.restoredCategoriesCount,
        restoredBalanceTypesCount: result.restoredBalanceTypesCount,
        restoredBalanceEntriesCount: result.restoredBalanceEntriesCount,
        ignoredSettingsCount: result.ignoredSettingsCount ?? 0,
        restoredSettingsCount: result.restoredSettingsCount ?? 0,
      });

      await Promise.all([
        loadTransactions(),
        loadCategories(),
        loadBalance(),
        refreshSettingsPreferences(),
      ]);
    } catch {
      setRestoreError("Couldn't restore backup. Try again.");
    } finally {
      setIsRestoring(false);
    }
  }

  async function handleSyncPress() {
    if (isSyncInFlightRef.current || isSyncDisabled) return;

    isSyncInFlightRef.current = true;
    setIsSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    setPersistedSyncResult(null);
    setIsSyncSummaryExpanded(false);

    try {
      const result = await manualSyncService.runIncrementalSync({
        auth: {
          status: authStatus,
          userId: authUser?.id,
        },
        source: 'manual',
      });

      if (result.status !== 'succeeded') {
        setSyncError("Couldn't sync. Try again.");

        return;
      }

      setSyncResult(createSyncUiResult(result));
      setPersistedSyncResult(null);
      setIsSyncSummaryExpanded(false);

      await Promise.all([
        loadTransactions(),
        loadCategories(),
        loadBalance(),
        refreshSettingsPreferences(),
      ]);

      try {
        const metadata = await getSyncMetadata();

        setLastSuccessfulSyncAtState(
          getSafeSyncTimestamp(metadata.lastSyncSummary?.completedAt) ??
            getSafeSyncTimestamp(metadata.lastSuccessfulSyncAt) ??
            result.lastSuccessfulSyncAt,
        );
        setLastSuccessfulSyncSourceState(
          getSafeSyncSource(metadata.lastSuccessfulSyncSource),
        );
        setPersistedSyncResult(
          createSyncUiResultFromSummary(metadata.lastSyncSummary),
        );
      } catch {
        setLastSuccessfulSyncAtState(result.lastSuccessfulSyncAt);
        setLastSuccessfulSyncSourceState('manual');
      }
    } catch {
      setSyncError("Couldn't sync. Try again.");
    } finally {
      isSyncInFlightRef.current = false;
      setIsSyncing(false);
    }
  }

  async function handleOpenExternalLink({
    emptyMessage,
    url,
  }: {
    emptyMessage: string;
    url: string;
  }) {
    const trimmedUrl = url.trim();

    if (trimmedUrl.length === 0) {
      setExternalLinkError(emptyMessage);

      return;
    }

    setExternalLinkError(null);

    try {
      await Linking.openURL(trimmedUrl);
    } catch {
      console.error('Failed to open external link');
      setExternalLinkError("Couldn't open this link right now.");
    }
  }

  function resetCategoryDrafts() {
    setNewCategoryName('');
    setNewCategoryIconName(null);
    setIsAddIconPickerExpanded(false);
    setAddCategoryError(null);
    setEditingCategoryId(null);
    setEditingName('');
    setEditingIconName(null);
    setIsEditIconPickerExpanded(false);
    setEditCategoryError(null);
  }

  function handleStartAddCategory() {
    clearCategoriesError();
    setOpenSwipeCategoryId(null);
    setArchiveCategoryError(null);
    setEditingCategoryId(null);
    setEditCategoryError(null);
    setIsAddingCategory(true);
  }

  async function handleAddCategory() {
    if (isCategoriesLoading) return;

    clearCategoriesError();
    setArchiveCategoryError(null);
    setEditCategoryError(null);

    const validationError = validateCategoryName({
      name: newCategoryName,
      categories,
    });

    setAddCategoryError(validationError);

    if (validationError) return;

    await addCategory({
      name: newCategoryName,
      iconName: newCategoryIconName ?? CATEGORY_ICON_FALLBACK_NAME,
    });

    if (!useCategoriesStore.getState().error) {
      resetCategoryDrafts();
      setIsAddingCategory(false);
    }
  }

  function handleStartEditCategory(category: Category) {
    clearCategoriesError();
    setOpenSwipeCategoryId(null);
    setIsAddingCategory(false);
    setAddCategoryError(null);
    setArchiveCategoryError(null);
    setEditingCategoryId(category.id);
    setEditingName(category.name);
    setEditingIconName(category.iconName);
    setIsEditIconPickerExpanded(false);
    setEditCategoryError(null);
  }

  async function handleSaveEditCategory() {
    if (!editingCategoryId || isCategoriesLoading) return;

    clearCategoriesError();
    setAddCategoryError(null);
    setArchiveCategoryError(null);

    const validationError = validateCategoryName({
      name: editingName,
      categories,
      currentCategoryId: editingCategoryId,
    });

    setEditCategoryError(validationError);

    if (validationError) return;

    await updateCategory(editingCategoryId, {
      name: editingName,
      iconName: editingIconName ?? CATEGORY_ICON_FALLBACK_NAME,
    });

    if (!useCategoriesStore.getState().error) resetCategoryDrafts();
  }

  function handleArchiveCategory(category: Category) {
    if (isCategoriesLoading) return;

    clearCategoriesError();
    setOpenSwipeCategoryId(null);
    setAddCategoryError(null);
    setEditCategoryError(null);

    const validationError = getArchiveCategoryError({
      category,
      categories,
    });

    setArchiveCategoryError(validationError);

    if (validationError) return;

    Alert.alert(
      t(language, 'settings.deleteCategoryTitle'),
      t(language, 'settings.deleteCategoryMessage'),
      [
        { text: t(language, 'common.cancel'), style: 'cancel' },
        {
          text: t(language, 'common.delete'),
          style: 'destructive',
          onPress: () => {
            void archiveCategory(category.id);
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentColumn}>
          <Text style={styles.title}>{t(language, 'settings.title')}</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t(language, 'settings.account')}
            </Text>

            <View style={styles.rowGroup}>
              <SettingsRow
                subtitle={t(language, 'settings.dailyReminderSubtitle')}
                title={t(language, 'settings.dailyReminder')}
                trailing={
                  <Switch
                    accessibilityLabel={t(
                      language,
                      'settings.dailyReminderA11y',
                    )}
                    disabled={isReminderDisabled}
                    onValueChange={(nextEnabled) => {
                      void handleReminderToggle(nextEnabled);
                    }}
                    value={isReminderUnsupported ? false : isReminderEnabled}
                  />
                }
              />

              <SettingsRow
                subtitle={t(language, 'settings.syncSubtitle')}
                title={t(language, 'settings.sync')}
                trailing={
                  <Switch
                    accessibilityLabel={t(language, 'settings.syncA11y')}
                    disabled={isSyncToggleDisabled}
                    onValueChange={(nextEnabled) => {
                      void handleForegroundSyncToggle(nextEnabled);
                    }}
                    value={
                      featureFlags.incrementalSyncEnabled &&
                      isForegroundSyncEnabled
                    }
                  />
                }
              />

              <SettingsRow
                onPress={() => {
                  setDraftCurrency(currency);
                  setSheet({
                    kind: 'currency',
                    title: t(language, 'settings.chooseCurrency'),
                  });
                }}
                title={t(language, 'settings.currency')}
                trailing={
                  <ActionText icon="chevron.up.chevron.down">
                    {currency}
                  </ActionText>
                }
              />

              <SettingsRow
                onPress={() => {
                  setDraftLanguage(language);
                  setSheet({
                    kind: 'language',
                    title: t(language, 'settings.chooseLanguage'),
                  });
                }}
                title={t(language, 'settings.language')}
                trailing={
                  <ActionText icon="chevron.up.chevron.down">
                    {language}
                  </ActionText>
                }
              />
            </View>

            {isReminderLoading ? (
              <Text style={styles.metaText}>
                {t(language, 'settings.checkingReminder')}
              </Text>
            ) : null}
            {isReminderUnsupported ? (
              <Text style={styles.metaText}>
                {t(language, 'settings.remindersUnsupported')}
              </Text>
            ) : null}
            {reminderError ? (
              <Text style={styles.errorText}>{reminderError}</Text>
            ) : null}
            {syncPreferenceError ? (
              <Text style={styles.errorText}>{syncPreferenceError}</Text>
            ) : null}
            {shouldShowSync ? (
              <View style={styles.syncOperationGroup}>
                <View style={styles.inlineStatusRow}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isSyncDisabled}
                    onPress={() => {
                      void handleSyncPress();
                    }}
                    style={isSyncDisabled ? styles.disabled : null}
                  >
                    <Text style={styles.inlineActionText}>
                      {isSyncing
                        ? t(language, 'settings.syncing')
                        : t(language, 'settings.syncNow')}
                    </Text>
                  </Pressable>
                </View>

                {lastSyncText ? (
                  <Text style={styles.metaText}>{lastSyncText}</Text>
                ) : null}
                {visibleSyncResult ? (
                  <SettingsInfoDisclosure
                    detail={formatSyncDetail(language, visibleSyncResult)}
                    expanded={isSyncSummaryExpanded}
                    onPress={() => {
                      setIsSyncSummaryExpanded((expanded) => !expanded);
                    }}
                    title={t(language, 'settings.syncSummaryTitle')}
                  />
                ) : null}
                {syncError ? (
                  <Text style={styles.errorText}>{syncError}</Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.categoryHeader}>
              <Text style={styles.categoryHeaderTitle}>
                {t(language, 'settings.categorySingular')}
              </Text>

              <Pressable
                accessibilityRole="button"
                onPress={handleStartAddCategory}
                style={styles.addCategoryButton}
              >
                <SafeSymbol
                  fallbackLabel="+"
                  name="plus"
                  size={14}
                  tintColor="#0088ff"
                />
                <Text style={styles.addCategoryText}>
                  {t(language, 'common.add')}
                </Text>
              </Pressable>
            </View>

            <View style={styles.categoryList}>
              {isAddingCategory ? (
                <View style={styles.categoryEditor}>
                  <TextInput
                    autoCapitalize="words"
                    autoCorrect={false}
                    onChangeText={(value) => {
                      setNewCategoryName(value);
                      setAddCategoryError(null);
                    }}
                    placeholder={t(language, 'settings.addCategoryPlaceholder')}
                    style={[
                      styles.categoryInput,
                      addCategoryError ? styles.inputError : null,
                    ]}
                    value={newCategoryName}
                  />

                  {addCategoryError ? (
                    <Text style={styles.errorText}>{addCategoryError}</Text>
                  ) : null}

                  <CategoryIconPicker
                    isExpanded={isAddIconPickerExpanded}
                    onExpand={() => setIsAddIconPickerExpanded(true)}
                    onIconPress={setNewCategoryIconName}
                    selectedIconName={newCategoryIconName}
                    testIDPrefix="settings-add-category-icon"
                  />

                  <View style={styles.categoryEditorActions}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isCategoriesLoading}
                      onPress={() => {
                        void handleAddCategory();
                      }}
                      style={styles.editorPrimaryButton}
                    >
                      <Text style={styles.editorPrimaryText}>
                        {t(language, 'common.save')}
                      </Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        resetCategoryDrafts();
                        setIsAddingCategory(false);
                      }}
                      style={styles.editorSecondaryButton}
                    >
                      <Text style={styles.editorSecondaryText}>
                        {t(language, 'common.cancel')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {!isCategoriesInitialized ? (
                <Text style={styles.metaText}>
                  {t(language, 'form.loadingCategories')}
                </Text>
              ) : null}

              {activeCategories.map((category) => {
                const isEditing = editingCategoryId === category.id;
                const isOtherCategory = category.id === OTHER_CATEGORY_ID;

                if (isEditing) {
                  return (
                    <View key={category.id} style={styles.categoryEditor}>
                      <TextInput
                        autoCapitalize="words"
                        autoCorrect={false}
                        onChangeText={(value) => {
                          setEditingName(value);
                          setEditCategoryError(null);
                        }}
                        style={[
                          styles.categoryInput,
                          editCategoryError ? styles.inputError : null,
                        ]}
                        value={editingName}
                      />

                      {editCategoryError ? (
                        <Text style={styles.errorText}>
                          {editCategoryError}
                        </Text>
                      ) : null}

                      <CategoryIconPicker
                        isExpanded={isEditIconPickerExpanded}
                        onExpand={() => setIsEditIconPickerExpanded(true)}
                        onIconPress={setEditingIconName}
                        selectedIconName={editingIconName}
                        testIDPrefix="settings-edit-category-icon"
                      />

                      <View style={styles.categoryEditorActions}>
                        <Pressable
                          accessibilityRole="button"
                          disabled={isCategoriesLoading}
                          onPress={() => {
                            void handleSaveEditCategory();
                          }}
                          style={styles.editorPrimaryButton}
                        >
                          <Text style={styles.editorPrimaryText}>
                            {t(language, 'common.save')}
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          onPress={resetCategoryDrafts}
                          style={styles.editorSecondaryButton}
                        >
                          <Text style={styles.editorSecondaryText}>
                            {t(language, 'common.cancel')}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                }

                return (
                  <SwipeCategoryRow
                    key={category.id}
                    category={category}
                    isDeleteDisabled={isOtherCategory}
                    isDisabled={isCategoriesLoading}
                    isOpen={openSwipeCategoryId === category.id}
                    language={language}
                    onDelete={handleArchiveCategory}
                    onEdit={handleStartEditCategory}
                    onSwipeClose={handleCategorySwipeClose}
                    onSwipeInteractionStart={
                      handleCategorySwipeInteractionStart
                    }
                    onSwipeOpen={handleCategorySwipeOpen}
                  />
                );
              })}

              {archiveCategoryError ? (
                <Text style={styles.errorText}>{archiveCategoryError}</Text>
              ) : null}
              {categoriesError ? (
                <Text style={styles.errorText}>{categoriesError}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t(language, 'settings.general')}
            </Text>

            <View style={styles.rowGroup}>
              <SettingsRow
                subtitle={
                  isAuthenticated
                    ? t(language, 'settings.authenticatedSubtitle')
                    : t(language, 'settings.guestSubtitle')
                }
                title={
                  isAuthenticated
                    ? getAccountDisplayName(authUser)
                    : t(language, 'settings.guestAccount')
                }
                trailing={
                  isAuthenticated ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={isSignOutDisabled}
                      onPress={() => {
                        void handleSignOutPress();
                      }}
                    >
                      <ActionText destructive disabled={isSignOutDisabled}>
                        {isAuthBusy
                          ? t(language, 'settings.signingOut')
                          : t(language, 'settings.signOut')}
                      </ActionText>
                    </Pressable>
                  ) : null
                }
              />

              <SettingsRow
                disabled={!isAuthenticated}
                subtitle={t(language, 'settings.manageAccountSubtitle')}
                title={t(language, 'settings.manageAccount')}
                trailing={
                  <Pressable
                    accessibilityRole="button"
                    disabled={isDeleteAccountDisabled || !isAuthenticated}
                    onPress={handleDeleteAccountPress}
                  >
                    <ActionText
                      destructive
                      disabled={isDeleteAccountDisabled || !isAuthenticated}
                    >
                      {isDeletingAccount
                        ? t(language, 'settings.deletingAccount')
                        : t(language, 'settings.deleteAccount')}
                    </ActionText>
                  </Pressable>
                }
              />

              <SettingsRow
                disabled={isImportDisabled}
                onPress={() => {
                  void handleImportPress();
                }}
                title={t(language, 'settings.importData')}
                trailing={
                  <ActionText disabled={isImportDisabled}>
                    {isImporting
                      ? t(language, 'settings.importing')
                      : t(language, 'settings.importCsv')}
                  </ActionText>
                }
              />

              <SettingsRow
                disabled={isExportDisabled}
                onPress={() => {
                  void handleExportPress();
                }}
                title={t(language, 'settings.exportData')}
                trailing={
                  <ActionText disabled={isExportDisabled}>
                    {isExporting
                      ? t(language, 'settings.exporting')
                      : t(language, 'settings.exportCsv')}
                  </ActionText>
                }
              />

              <View style={styles.operationDisclosureGroup}>
                <SettingsRow
                  disabled={isBackupDisabled}
                  onPress={() => {
                    void handleBackupPress();
                  }}
                  title={t(language, 'settings.backup')}
                  trailing={
                    <ActionText disabled={isBackupDisabled}>
                      {isBackingUp
                        ? t(language, 'settings.creatingBackup')
                        : t(language, 'settings.createBackup')}
                    </ActionText>
                  }
                />

                {backupResult ? (
                  <SettingsInfoDisclosure
                    detail={formatBackupDetail(language, backupResult)}
                    expanded={isBackupSummaryExpanded}
                    onPress={() => {
                      setIsBackupSummaryExpanded((expanded) => !expanded);
                    }}
                    title={t(language, 'settings.backupSummaryTitle')}
                  />
                ) : null}
              </View>

              <SettingsRow
                disabled={isRestoreDisabled}
                onPress={() => {
                  void handleRestorePress();
                }}
                title={t(language, 'settings.restore')}
                trailing={
                  <ActionText disabled={isRestoreDisabled}>
                    {isRestoring
                      ? t(language, 'settings.restoringBackup')
                      : t(language, 'settings.restoreFromBackup')}
                  </ActionText>
                }
              />

              <SettingsRow
                onPress={() => {
                  void handleOpenExternalLink({
                    emptyMessage: 'Privacy policy is not available right now.',
                    url: APP_LINKS.privacyPolicyUrl,
                  });
                }}
                title={t(language, 'settings.privacyPolicy')}
                trailing={
                  <ActionText icon="arrow.up.right">
                    {t(language, 'common.read')}
                  </ActionText>
                }
              />

              <SettingsRow
                onPress={() => {
                  void handleOpenExternalLink({
                    emptyMessage: 'Support contact is not available right now.',
                    url: APP_LINKS.supportUrl,
                  });
                }}
                title={t(language, 'settings.support')}
                trailing={
                  <ActionText icon="arrow.up.right">
                    {t(language, 'common.read')}
                  </ActionText>
                }
              />
            </View>

            {!isAuthenticated &&
            (isGoogleAuthAvailable || shouldShowAppleAuth) ? (
              <View style={styles.authActions}>
                {isGoogleAuthAvailable ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isGoogleAuthDisabled}
                    onPress={() => {
                      void handleGoogleSignInPress();
                    }}
                    style={[
                      styles.authButton,
                      isGoogleAuthDisabled ? styles.disabled : null,
                    ]}
                  >
                    <Text style={styles.authButtonText}>
                      {isAuthBusy
                        ? t(language, 'settings.openingGoogle')
                        : t(language, 'settings.continueGoogle')}
                    </Text>
                  </Pressable>
                ) : null}

                {shouldShowAppleAuth ? (
                  <AppleAuthentication.AppleAuthenticationButton
                    accessibilityLabel={t(language, 'settings.continueApple')}
                    buttonStyle={
                      AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                    }
                    buttonType={
                      AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
                    }
                    cornerRadius={12}
                    onPress={() => {
                      void handleAppleSignInPress();
                    }}
                    pointerEvents={isAppleAuthDisabled ? 'none' : 'auto'}
                    style={[
                      styles.appleButton,
                      isAppleAuthDisabled ? styles.disabled : null,
                    ]}
                  />
                ) : null}
              </View>
            ) : null}

            {accountError ? (
              <Text style={styles.errorText}>{accountError}</Text>
            ) : null}
            {authError ? (
              <Text style={styles.errorText}>
                {t(language, 'settings.accountUpdateError')}
              </Text>
            ) : null}
            {deleteAccountError ? (
              <Text style={styles.errorText}>{deleteAccountError}</Text>
            ) : null}
            {lastBackupText ? (
              <Text style={styles.metaText}>{lastBackupText}</Text>
            ) : null}
            {backupError ? (
              <Text style={styles.errorText}>{backupError}</Text>
            ) : null}
            {restoreResult ? (
              <Text style={styles.infoText}>
                {formatRestoreResult(restoreResult)}
              </Text>
            ) : null}
            {isRestoreEmpty ? (
              <Text style={styles.infoText}>
                {t(language, 'settings.noBackupFound')}
              </Text>
            ) : null}
            {restoreError ? (
              <Text style={styles.errorText}>{restoreError}</Text>
            ) : null}
            {importResult ? (
              <Text style={styles.infoText}>
                {formatImportResult(importResult)}
              </Text>
            ) : null}
            {isImportUnsupported ? (
              <Text style={styles.metaText}>
                {IMPORT_TRANSACTIONS_UNSUPPORTED_ERROR_MESSAGE}
              </Text>
            ) : null}
            {shouldShowTransactionsError ? (
              <Text style={styles.errorText}>{transactionsError}</Text>
            ) : null}
            {importError ? (
              <Text style={styles.errorText}>{importError}</Text>
            ) : null}
            {exportError ? (
              <Text style={styles.errorText}>{exportError}</Text>
            ) : null}
            {externalLinkError ? (
              <Text style={styles.errorText}>{externalLinkError}</Text>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <OptionSheet
        draftCurrency={draftCurrency}
        draftLanguage={draftLanguage}
        language={language}
        onApply={() => {
          void handleApplySheet();
        }}
        onClose={handleCloseSheet}
        onSelectCurrency={setDraftCurrency}
        onSelectLanguage={setDraftLanguage}
        sheet={sheet}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f7f5',
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 21,
    paddingTop: 24,
    paddingBottom: 132,
  },
  contentColumn: {
    width: '100%',
    maxWidth: 360,
    gap: 32,
  },
  title: {
    color: '#100f10',
    fontFamily: TITLE_FONT_FAMILY,
    fontSize: 36,
    fontWeight: TITLE_FONT_WEIGHT,
    lineHeight: 42,
  },
  section: {
    gap: 24,
  },
  sectionTitle: {
    color: '#100f10',
    fontFamily: TITLE_FONT_FAMILY,
    fontSize: 24,
    fontWeight: TITLE_FONT_WEIGHT,
    lineHeight: 30,
  },
  rowGroup: {
    gap: 16,
  },
  operationDisclosureGroup: {
    gap: 8,
  },
  settingsRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsRowTall: {
    minHeight: 68,
  },
  rowCopy: {
    flex: 1,
    justifyContent: 'center',
  },
  rowTitle: {
    color: '#100f10',
    fontSize: 17,
    lineHeight: 22,
  },
  rowSubtitle: {
    color: 'rgba(60, 60, 67, 0.6)',
    fontSize: 15,
    lineHeight: 20,
  },
  rowTrailing: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  actionTextWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  actionText: {
    fontSize: 15,
    lineHeight: 20,
  },
  inlineStatusRow: {
    alignItems: 'flex-end',
  },
  syncOperationGroup: {
    gap: 8,
    marginTop: -14,
  },
  inlineActionText: {
    color: '#0088ff',
    fontSize: 15,
    lineHeight: 20,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryHeaderTitle: {
    color: '#100f10',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 21,
  },
  addCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  addCategoryText: {
    color: '#0088ff',
    fontSize: 15,
    lineHeight: 20,
  },
  categoryList: {
    gap: 8,
  },
  categorySwipeContainer: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  categorySwipeActionSlot: {
    height: 52,
    alignItems: 'flex-start',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  categorySwipeActionSlotTrailing: {
    alignItems: 'flex-end',
  },
  categorySwipeActionCircle: {
    width: CATEGORY_SWIPE_ACTION_SIZE,
    height: CATEGORY_SWIPE_ACTION_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CATEGORY_SWIPE_ACTION_SIZE / 2,
  },
  categoryPill: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
    paddingHorizontal: 16,
  },
  categoryName: {
    flex: 1,
    color: '#100f10',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 21,
  },
  categoryDeleteAction: {
    backgroundColor: '#ff383c',
  },
  categoryEditAction: {
    backgroundColor: '#34c759',
  },
  categoryEditor: {
    gap: 12,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    padding: 14,
  },
  categoryInput: {
    borderWidth: 1,
    borderColor: '#d8d8d8',
    borderRadius: 14,
    color: '#100f10',
    fontSize: 17,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputError: {
    borderColor: '#ff383c',
  },
  categoryEditorActions: {
    flexDirection: 'row',
    gap: 10,
  },
  editorPrimaryButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#100f10',
    paddingVertical: 12,
  },
  editorPrimaryText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  editorSecondaryButton: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d8d8d8',
    borderRadius: 14,
    paddingVertical: 12,
  },
  editorSecondaryText: {
    color: '#100f10',
    fontSize: 15,
    fontWeight: '700',
  },
  authActions: {
    gap: 12,
  },
  authButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#100f10',
    paddingVertical: 14,
  },
  authButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  appleButton: {
    width: '100%',
    height: 48,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    minHeight: '92%',
    overflow: 'hidden',
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 37.5,
    shadowOffset: { width: 0, height: 15 },
  },
  grabber: {
    width: 36,
    height: 5,
    alignSelf: 'center',
    borderRadius: 100,
    backgroundColor: '#cccccc',
    marginTop: 5,
    marginBottom: 6,
  },
  sheetHeader: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  sheetCircleButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  sheetCloseButton: {
    backgroundColor: '#f0f0f0',
  },
  sheetApplyButton: {
    backgroundColor: '#0088ff',
  },
  sheetTitle: {
    color: '#1a1a1a',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  sheetList: {
    overflow: 'hidden',
    borderRadius: 26,
    backgroundColor: '#ffffff',
    marginTop: 20,
  },
  sheetOptionRow: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  sheetCheckSlot: {
    width: 37,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sheetSelectedCircle: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#34c759',
  },
  sheetOptionContent: {
    flex: 1,
    height: 52,
    justifyContent: 'center',
  },
  sheetSeparator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e6e6e6',
  },
  sheetOptionText: {
    color: '#000000',
    fontSize: 17,
    lineHeight: 22,
  },
  infoDisclosure: {
    width: '100%',
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    padding: 8,
  },
  infoDisclosureCopy: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 4,
  },
  infoDisclosureTitle: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: -0.43,
    lineHeight: 22,
  },
  infoDisclosureDetail: {
    color: 'rgba(60, 60, 67, 0.6)',
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: -0.23,
    lineHeight: 20,
  },
  metaText: {
    color: 'rgba(60, 60, 67, 0.6)',
    fontSize: 13,
    lineHeight: 18,
  },
  infoText: {
    color: '#4b5563',
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    lineHeight: 20,
  },
  disabled: {
    opacity: 0.55,
  },
  symbolFallback: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  categoryIconFallback: {
    color: '#100f10',
    fontSize: 11,
    fontWeight: '700',
  },
});
