import type { BalanceType, BalanceTypeInput } from '@/types/balance';

export const BALANCE_TYPE_NAME_MAX_LENGTH = 32;

type CreateBalanceTypeFromNameParams = {
  balanceTypes: BalanceType[];
  name: string;
};

type ValidateBalanceTypeNameParams = {
  balanceTypes: BalanceType[];
  name: string;
};

function generateBalanceTypeId(name: string) {
  const slug = name
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const normalizedSlug = slug || 'balance-type';

  return `${normalizedSlug}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function normalizeBalanceTypeName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

export function sortBalanceTypes(balanceTypes: BalanceType[]) {
  return [...balanceTypes].sort((firstType, secondType) => {
    if (firstType.sortOrder !== secondType.sortOrder) {
      return firstType.sortOrder - secondType.sortOrder;
    }

    if (firstType.createdAt !== secondType.createdAt) {
      return firstType.createdAt - secondType.createdAt;
    }

    return firstType.id.localeCompare(secondType.id);
  });
}

export function getActiveBalanceTypes(balanceTypes: BalanceType[]) {
  return sortBalanceTypes(
    balanceTypes.filter((balanceType) => !balanceType.isArchived),
  );
}

export function validateBalanceTypeName({
  balanceTypes,
  name,
}: ValidateBalanceTypeNameParams) {
  const normalizedName = normalizeBalanceTypeName(name);

  if (!normalizedName) return 'Balance type name is required.';

  if (normalizedName.length > BALANCE_TYPE_NAME_MAX_LENGTH) {
    return `Balance type name must be ${BALANCE_TYPE_NAME_MAX_LENGTH} characters or less.`;
  }

  const normalizedLookupName = normalizedName.toLocaleLowerCase();
  const hasDuplicateActiveType = balanceTypes.some((balanceType) => {
    return (
      !balanceType.isArchived &&
      normalizeBalanceTypeName(balanceType.name).toLocaleLowerCase() ===
        normalizedLookupName
    );
  });

  if (hasDuplicateActiveType) {
    return 'An active balance type with this name already exists.';
  }

  return null;
}

export function createBalanceTypeFromName({
  balanceTypes,
  name,
}: CreateBalanceTypeFromNameParams): BalanceTypeInput {
  const normalizedName = normalizeBalanceTypeName(name);
  const maxSortOrder = balanceTypes.reduce((currentMax, balanceType) => {
    return Math.max(currentMax, balanceType.sortOrder);
  }, -1);
  const now = Date.now();

  return {
    id: generateBalanceTypeId(normalizedName),
    name: normalizedName,
    createdAt: now,
    updatedAt: now,
    isDefault: false,
    isArchived: false,
    sortOrder: maxSortOrder + 1,
  };
}
