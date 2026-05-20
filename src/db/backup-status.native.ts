import { getDatabase, initDatabase } from './database.native';
import { ensureAppMetadataTable } from './local-identity.native';

type AppMetadataRow = {
  value: unknown;
};

const LAST_SUCCESSFUL_BACKUP_AT_KEY = 'last_successful_backup_at';

export async function getLastSuccessfulBackupAt(): Promise<number | null> {
  await initDatabase();

  const database = await getDatabase();

  await ensureAppMetadataTable(database);

  const row = await database.getFirstAsync<AppMetadataRow>(
    `
      SELECT value
      FROM app_metadata
      WHERE key = ?
    `,
    LAST_SUCCESSFUL_BACKUP_AT_KEY,
  );

  return parseStoredTimestamp(row?.value);
}

export async function setLastSuccessfulBackupAt(timestamp: number) {
  if (!Number.isFinite(timestamp)) {
    throw new Error('Last backup timestamp must be finite.');
  }

  await initDatabase();

  const database = await getDatabase();
  const normalizedTimestamp = Math.trunc(timestamp);

  await ensureAppMetadataTable(database);

  await database.runAsync(
    `
      INSERT OR REPLACE INTO app_metadata (
        key,
        value,
        updated_at
      ) VALUES (?, ?, ?)
    `,
    LAST_SUCCESSFUL_BACKUP_AT_KEY,
    String(normalizedTimestamp),
    normalizedTimestamp,
  );
}

function parseStoredTimestamp(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) return null;

  const timestamp = Number(value);

  if (!Number.isFinite(timestamp)) return null;

  return timestamp;
}
