#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const scriptPath = path.resolve(
  process.argv[1] || path.join(process.cwd(), 'scripts/release-preflight.js'),
);
const rootDir = path.resolve(path.dirname(scriptPath), '..');
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

let passed = 0;
let failed = 0;

function ok(message) {
  console.log(`PASS ${message}`);
  passed += 1;
}

function fail(message) {
  console.log(`FAIL ${message}`);
  failed += 1;
}

function runCheck(callback) {
  try {
    callback();
  } catch (error) {
    fail(error.message);
  }
}

function readJson(relativePath) {
  const filePath = path.join(rootDir, relativePath);

  if (!fs.existsSync(filePath)) {
    throw new Error(`${relativePath} is missing`);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${relativePath} is not valid JSON: ${error.message}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      `${label} expected ${JSON.stringify(expected)} but found ${JSON.stringify(actual)}`,
    );
  }
}

const packageJson = readJson('package.json');
let easJson = null;

runCheck(() => {
  const version = packageJson.version;

  if (typeof version !== 'string' || version.length === 0) {
    throw new Error('package.json version is missing');
  }

  if (!semverPattern.test(version)) {
    throw new Error(
      `package.json version must be strict semver x.y.z, found ${JSON.stringify(version)}`,
    );
  }

  ok(`package.json version is valid semver (${version})`);
});

runCheck(() => {
  const appConfigPath = path.join(rootDir, 'app.config.js');

  if (!fs.existsSync(appConfigPath)) {
    throw new Error('app.config.js is missing');
  }

  delete require.cache[require.resolve(appConfigPath)];
  const appConfig = require(appConfigPath);

  if (!appConfig || typeof appConfig !== 'object') {
    throw new Error('app.config.js did not export a config object');
  }

  assertEqual(
    appConfig.version,
    packageJson.version,
    'app.config.js resolved version',
  );

  ok(
    `app.config.js resolves the same Expo version as package.json (${appConfig.version})`,
  );
});

runCheck(() => {
  easJson = readJson('eas.json');
  ok('eas.json exists and parses successfully');
});

runCheck(() => {
  const appVersionSource = easJson?.cli?.appVersionSource;
  assertEqual(appVersionSource, 'remote', 'eas.json cli.appVersionSource');
  ok('eas.json sets cli.appVersionSource to "remote"');
});

runCheck(() => {
  const autoIncrement = easJson?.build?.production?.autoIncrement;
  assertEqual(autoIncrement, true, 'eas.json build.production.autoIncrement');
  ok('eas.json sets build.production.autoIncrement to true');
});

runCheck(() => {
  const environment = easJson?.build?.production?.environment;
  assertEqual(
    environment,
    'production',
    'eas.json build.production.environment',
  );
  ok('eas.json sets build.production.environment to "production"');
});

runCheck(() => {
  const iosSubmit = easJson?.submit?.production?.ios;

  if (!iosSubmit || typeof iosSubmit !== 'object') {
    throw new Error('eas.json submit.production.ios is missing');
  }

  const expectedPlaceholders = {
    ascAppId: '__EXPO_ASC_APP_ID__',
    ascApiKeyPath: '__EXPO_ASC_API_KEY_PATH__',
    ascApiKeyIssuerId: '__EXPO_ASC_API_KEY_ISSUER_ID__',
    ascApiKeyId: '__EXPO_ASC_API_KEY_ID__',
  };

  for (const [key, expectedValue] of Object.entries(expectedPlaceholders)) {
    assertEqual(
      iosSubmit[key],
      expectedValue,
      `eas.json submit.production.ios.${key}`,
    );
  }

  ok('eas.json submit.production.ios keeps the CI placeholder values');
});

runCheck(() => {
  const workflowPath = path.join(rootDir, '.github/workflows/release-ios.yml');

  if (!fs.existsSync(workflowPath)) {
    throw new Error('.github/workflows/release-ios.yml is missing');
  }

  ok('.github/workflows/release-ios.yml exists');
});

runCheck(() => {
  const workflowPath = path.join(rootDir, '.github/workflows/pr-checks.yml');

  if (!fs.existsSync(workflowPath)) {
    throw new Error('.github/workflows/pr-checks.yml is missing');
  }

  ok('.github/workflows/pr-checks.yml exists');
});

console.log('');
console.log(`Release preflight summary: ${passed} passed, ${failed} failed.`);

if (failed > 0) {
  process.exitCode = 1;
}
