import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { TRANSACTIONS_CSV_HEADER } from '@/features/export/transactions-csv-format';

describe('project contracts', () => {
  it('keeps Transaction CSV v1 header unchanged', () => {
    const csvFormat = readFileSync(
      join(process.cwd(), 'src/features/export/transactions-csv-format.ts'),
      'utf8',
    );

    expect(TRANSACTIONS_CSV_HEADER).toBe(
      'id,amount,category,isLeak,leakReason,note,createdAt',
    );
    expect(csvFormat).toContain('export const TRANSACTIONS_CSV_COLUMNS = [');
    expect(csvFormat).toContain("'id'");
    expect(csvFormat).toContain("'amount'");
    expect(csvFormat).toContain("'category'");
    expect(csvFormat).toContain("'isLeak'");
    expect(csvFormat).toContain("'leakReason'");
    expect(csvFormat).toContain("'note'");
    expect(csvFormat).toContain("'createdAt'");
    expect(csvFormat).not.toContain("'balance");
    expect(csvFormat).not.toContain("'icon");
    expect(csvFormat).not.toContain("'language");
  });

  it('does not add language fields to transaction, balance, or category contracts', () => {
    const contractFiles = [
      'src/types/transaction.ts',
      'src/types/balance.ts',
      'src/types/category.ts',
    ];

    for (const filePath of contractFiles) {
      const source = readFileSync(join(process.cwd(), filePath), 'utf8');

      expect(source).not.toMatch(/\blanguage\b|\blocale\b/);
    }
  });

  it('keeps bottom tabs limited to Home, Analytics & Leaks, and Settings', () => {
    const tabsLayout = readFileSync(
      join(process.cwd(), 'app/(tabs)/_layout.tsx'),
      'utf8',
    );

    expect(tabsLayout).toContain('<Tabs.Screen');
    expect(tabsLayout.match(/<Tabs\.Screen/g)).toHaveLength(3);
    expect(tabsLayout).toContain('name="index"');
    expect(tabsLayout).toContain('name="analytics"');
    expect(tabsLayout).toContain('name="settings"');
    expect(tabsLayout).toContain("t(language, 'tabs.home')");
    expect(tabsLayout).toContain("t(language, 'tabs.analytics')");
    expect(tabsLayout).toContain("t(language, 'tabs.analyticsTitle')");
    expect(tabsLayout).toContain("t(language, 'tabs.settings')");
    expect(tabsLayout).toContain('numberOfLines={2}');
    expect(tabsLayout).toContain('adjustsFontSizeToFit');
    expect(tabsLayout).not.toContain('name="add-transaction"');
    expect(tabsLayout).not.toContain('name="add-balance"');
    expect(tabsLayout).not.toContain('name="shame-card"');
  });

  it('keeps the Analytics tab label layout-driven without hard line breaks', () => {
    const translations = readFileSync(
      join(process.cwd(), 'src/lib/i18n/translations.ts'),
      'utf8',
    );
    const analyticsTabLabels = translations.match(
      /'tabs\.analytics': '[^']*'/g,
    );

    expect(analyticsTabLabels).not.toBeNull();

    for (const label of analyticsTabLabels ?? []) {
      expect(label).not.toContain('\\n');
    }
  });

  it('keeps pushed app routes as root stack screens', () => {
    const rootLayout = readFileSync(
      join(process.cwd(), 'app/_layout.tsx'),
      'utf8',
    );

    expect(rootLayout).toContain('name="add-transaction"');
    expect(rootLayout).toContain('name="add-balance"');
    expect(rootLayout).toContain('name="transaction/[id]/edit"');
    expect(rootLayout).toContain('name="balance/[id]/edit"');
    expect(rootLayout).not.toContain('name="categories"');
    expect(rootLayout).not.toContain('name="shame-card"');
  });

  it('does not add forbidden UI dependencies', () => {
    const packageJson = readFileSync(
      join(process.cwd(), 'package.json'),
      'utf8',
    );
    const packageLock = readFileSync(
      join(process.cwd(), 'package-lock.json'),
      'utf8',
    );
    const forbiddenDependencyPattern = new RegExp(
      [
        ['@expo', 'ui'].join('/'),
        ['@expo', 'ui-swift-ui'].join('/'),
        ['expo', 'blur'].join('-'),
        ['Blur', 'View'].join(''),
        ['Liquid', 'Glass'].join(' '),
        ['glass', 'styles'].join('-'),
      ].join('|'),
    );

    expect(packageJson).not.toMatch(forbiddenDependencyPattern);
    expect(packageLock).not.toMatch(forbiddenDependencyPattern);
  });

  it('keeps ML-96 version bump and Expo metadata aligned', () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
    ) as { version: string };
    const packageLock = JSON.parse(
      readFileSync(join(process.cwd(), 'package-lock.json'), 'utf8'),
    ) as { packages: { '': { version: string } }; version: string };
    const appConfig = readFileSync(
      join(process.cwd(), 'app.config.js'),
      'utf8',
    );
    const appJson = readFileSync(join(process.cwd(), 'app.json'), 'utf8');
    const easJson = readFileSync(join(process.cwd(), 'eas.json'), 'utf8');

    expect(packageJson.version).toBe('1.27.5');
    expect(packageLock.version).toBe('1.27.5');
    expect(packageLock.packages[''].version).toBe('1.27.5');
    expect(appConfig).toContain(
      "const { version } = require('./package.json');",
    );
    expect(appJson).not.toContain('"version"');
    expect(easJson).toContain('"appVersionSource": "remote"');
  });
});
