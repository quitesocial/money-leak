import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('project contracts', () => {
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
    expect(tabsLayout).toContain("label: 'Home'");
    expect(tabsLayout).toContain("label: 'Analytics\\n& Leaks'");
    expect(tabsLayout).toContain("title: 'Analytics & Leaks'");
    expect(tabsLayout).toContain("label: 'Settings'");
    expect(tabsLayout).not.toContain('name="add-transaction"');
    expect(tabsLayout).not.toContain('name="add-balance"');
    expect(tabsLayout).not.toContain('name="shame-card"');
  });

  it('keeps Add Transaction, Add Balance, and Shame Card as root stack screens', () => {
    const rootLayout = readFileSync(
      join(process.cwd(), 'app/_layout.tsx'),
      'utf8',
    );

    expect(rootLayout).toContain('name="add-transaction"');
    expect(rootLayout).toContain('name="add-balance"');
    expect(rootLayout).toContain('name="shame-card"');
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
});
