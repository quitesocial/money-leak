type AlternativeCatalogItem = {
  id: string;
  singularLabel: string;
  pluralLabel: string;
  unitPrice: number;
  catalogOrder: number;
};

export type AlternativeRealityItem = {
  id: string;
  label: string;
  unitPrice: number;
  count: number;
  totalValue: number;
};

type AlternativeRealityItemWithOrder = AlternativeRealityItem & {
  catalogOrder: number;
};

export type AlternativeRealityResult = {
  totalLeaks: number;
  items: AlternativeRealityItem[];
  primaryItem: AlternativeRealityItem | null;
};

const ALTERNATIVE_CATALOG: AlternativeCatalogItem[] = [
  {
    id: 'coffee',
    singularLabel: 'coffee',
    pluralLabel: 'coffees',
    unitPrice: 2.5,
    catalogOrder: 0,
  },
  {
    id: 'kebab',
    singularLabel: 'kebab',
    pluralLabel: 'kebabs',
    unitPrice: 8,
    catalogOrder: 1,
  },
  {
    id: 'gym_month',
    singularLabel: 'gym month',
    pluralLabel: 'gym months',
    unitPrice: 35,
    catalogOrder: 2,
  },
  {
    id: 'ps5_game',
    singularLabel: 'PS5 game',
    pluralLabel: 'PS5 games',
    unitPrice: 70,
    catalogOrder: 3,
  },
  {
    id: 'day_trip',
    singularLabel: 'day trip',
    pluralLabel: 'day trips',
    unitPrice: 150,
    catalogOrder: 4,
  },
];

function sanitizeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function getAlternativeLabel({
  singularLabel,
  pluralLabel,
  count,
}: Pick<AlternativeCatalogItem, 'singularLabel' | 'pluralLabel'> & {
  count: number;
}) {
  return count === 1 ? singularLabel : pluralLabel;
}

function sortAlternativeRealityItems(
  firstItem: AlternativeRealityItemWithOrder,
  secondItem: AlternativeRealityItemWithOrder,
) {
  if (secondItem.count !== firstItem.count) return secondItem.count - firstItem.count;

  if (secondItem.totalValue !== firstItem.totalValue) return secondItem.totalValue - firstItem.totalValue;

  return firstItem.catalogOrder - secondItem.catalogOrder;
}

export function calculateAlternativeReality(
  totalLeaks: number,
): AlternativeRealityResult {
  const sanitizedTotalLeaks = sanitizeNumber(totalLeaks);

  if (sanitizedTotalLeaks <= 0) {
    return {
      totalLeaks: 0,
      items: [],
      primaryItem: null,
    };
  }

  const itemsWithOrder =
    ALTERNATIVE_CATALOG.map<AlternativeRealityItemWithOrder | null>(
      (catalogItem) => {
        const count = Math.floor(sanitizedTotalLeaks / catalogItem.unitPrice);

        if (count < 1) return null;

        return {
          id: catalogItem.id,
          label: getAlternativeLabel({
            singularLabel: catalogItem.singularLabel,
            pluralLabel: catalogItem.pluralLabel,
            count,
          }),
          unitPrice: catalogItem.unitPrice,
          count,
          totalValue: count * catalogItem.unitPrice,
          catalogOrder: catalogItem.catalogOrder,
        };
      },
    ).filter((item): item is AlternativeRealityItemWithOrder => item !== null);

  const sortedItems = itemsWithOrder
    .sort(sortAlternativeRealityItems)
    .map((item) => ({
      id: item.id,
      label: item.label,
      unitPrice: item.unitPrice,
      count: item.count,
      totalValue: item.totalValue,
    }));

  return {
    totalLeaks: sanitizedTotalLeaks,
    items: sortedItems,
    primaryItem: sortedItems[0] ?? null,
  };
}
