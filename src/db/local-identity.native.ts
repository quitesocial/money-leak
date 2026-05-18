export type LocalDatabaseIdentity = {
  localOwnerId: string;
  deviceId: string;
};

type AppMetadataDatabase = {
  execAsync(source: string): Promise<void>;
  getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]>;
  runAsync(source: string, ...params: unknown[]): Promise<unknown>;
};

type AppMetadataRow = {
  key: unknown;
  value: unknown;
};

const LOCAL_OWNER_ID_KEY = 'local_owner_id';
const DEVICE_ID_KEY = 'device_id';

export const CREATE_APP_METADATA_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`;

export async function ensureAppMetadataTable(database: AppMetadataDatabase) {
  await database.execAsync(CREATE_APP_METADATA_TABLE_SQL);
}

export async function ensureLocalIdentity(
  database: AppMetadataDatabase,
): Promise<LocalDatabaseIdentity> {
  await ensureAppMetadataTable(database);

  const rows = await database.getAllAsync<AppMetadataRow>(
    `
      SELECT key, value
      FROM app_metadata
      WHERE key IN (?, ?)
    `,
    LOCAL_OWNER_ID_KEY,
    DEVICE_ID_KEY,
  );

  const currentValues = new Map(
    rows
      .filter(
        (row): row is { key: string; value: string } =>
          typeof row.key === 'string' && typeof row.value === 'string',
      )
      .map((row) => [row.key, row.value]),
  );

  const localOwnerId = getStableIdentityValue({
    currentValue: currentValues.get(LOCAL_OWNER_ID_KEY),
    prefix: 'local',
  });

  const deviceId = getStableIdentityValue({
    currentValue: currentValues.get(DEVICE_ID_KEY),
    prefix: 'device',
  });

  await upsertMetadataValue({
    database,
    key: LOCAL_OWNER_ID_KEY,
    value: localOwnerId,
  });

  await upsertMetadataValue({
    database,
    key: DEVICE_ID_KEY,
    value: deviceId,
  });

  return { localOwnerId, deviceId };
}

function getStableIdentityValue({
  currentValue,
  prefix,
}: {
  currentValue: string | undefined;
  prefix: 'device' | 'local';
}) {
  if (currentValue?.startsWith(`${prefix}_`)) return currentValue;

  return `${prefix}_${generateUuid()}`;
}

async function upsertMetadataValue({
  database,
  key,
  value,
}: {
  database: AppMetadataDatabase;
  key: string;
  value: string;
}) {
  await database.runAsync(
    `
      INSERT OR REPLACE INTO app_metadata (
        key,
        value,
        updated_at
      ) VALUES (?, ?, ?)
    `,
    key,
    value,
    Date.now(),
  );
}

function generateUuid() {
  const uuid = globalThis.crypto?.randomUUID?.();

  if (uuid) return uuid;

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
