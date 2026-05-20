import { Platform } from 'react-native';

import * as nativeAccountLinking from './account-linking.native';
import * as webAccountLinking from './account-linking.web';

export type {
  LocalAccountLinkingResult,
  LocalAccountLinkingSkippedReason,
} from './account-linking.native';

const accountLinkingModule =
  Platform.OS === 'web' ? webAccountLinking : nativeAccountLinking;

export const { linkLocalAccount } = accountLinkingModule;
