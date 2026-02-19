import { Inventory, InventoryType, ItemData, Slot, SlotWithItem, State } from '../typings';
import { isEqual } from 'lodash';
import { store } from '../store';
import { Items } from '../store/items';
import { imagepath } from '../store/imagepath';
import { fetchNui } from '../utils/fetchNui';
import { CLOTHING_ITEM_REGISTRY } from '../typings/clothing';

export const canPurchaseItem = (item: Slot, inventory: { type: Inventory['type']; groups: Inventory['groups'] }) => {
  if (inventory.type !== 'shop' || !isSlotWithItem(item)) return true;

  if (item.count !== undefined && item.count === 0) return false;

  if (item.grade === undefined || !inventory.groups) return true;

  const leftInventory = store.getState().inventory.leftInventory;

  if (!leftInventory.groups) return false;

  const reqGroups = Object.keys(inventory.groups);

  if (Array.isArray(item.grade)) {
    for (let i = 0; i < reqGroups.length; i++) {
      const reqGroup = reqGroups[i];
      if (leftInventory.groups[reqGroup] !== undefined) {
        const playerGrade = leftInventory.groups[reqGroup];
        for (let j = 0; j < item.grade.length; j++) {
          if (playerGrade === item.grade[j]) return true;
        }
      }
    }
    return false;
  } else {
    for (let i = 0; i < reqGroups.length; i++) {
      const reqGroup = reqGroups[i];
      if (leftInventory.groups[reqGroup] !== undefined) {
        if (leftInventory.groups[reqGroup] >= item.grade) return true;
      }
    }
    return false;
  }
};

export const canCraftItem = (item: Slot, inventoryType: string) => {
  if (!isSlotWithItem(item) || inventoryType !== 'crafting') return true;
  if (!item.ingredients) return true;
  const leftInventory = store.getState().inventory.leftInventory;
  const ingredientItems = Object.entries(item.ingredients);

  const remainingItems = ingredientItems.filter((ingredient) => {
    const [item, count] = [ingredient[0], ingredient[1]];
    const globalItem = Items[item];

    if (count >= 1) {
      if (globalItem && globalItem.count >= count) return false;
    }

    const hasItem = leftInventory.items.find((playerItem) => {
      if (isSlotWithItem(playerItem) && playerItem.name === item) {
        if (count < 1) {
          if (playerItem.metadata?.durability >= count * 100) return true;
          return false;
        }
      }
    });

    return !hasItem;
  });

  return remainingItems.length === 0;
};

export const isSlotWithItem = (slot: Slot, strict: boolean = false): slot is SlotWithItem =>
  (slot.name !== undefined && slot.weight !== undefined) ||
  (strict && slot.name !== undefined && slot.count !== undefined && slot.weight !== undefined);

export const canStack = (sourceSlot: Slot, targetSlot: Slot) =>
  sourceSlot.name === targetSlot.name && isEqual(sourceSlot.metadata, targetSlot.metadata);

/**
 * Cek apakah slot index tertentu adalah clothing slot.
 * Clothing slots dimulai dari index baseSlots (0-based) ke atas.
 */
export const isClothingSlotIndex = (slotNumber: number, inventory: Inventory): boolean => {
  if (inventory.type !== 'player') return false;
  const baseSlots = inventory.baseSlots ?? inventory.slots;
  return slotNumber > baseSlots;
};

/**
 * findAvailableSlot — FIX BUG 2:
 * Hanya cari slot di range base slot (1..baseSlots).
 * Clothing slots (baseSlots+1..end) TIDAK boleh dipakai sebagai target auto-drop.
 */
export const findAvailableSlot = (item: Slot, data: ItemData, items: Slot[], baseSlots?: number) => {
  // Batasi pencarian hanya ke base slots jika baseSlots diberikan
  const searchItems = baseSlots != null ? items.slice(0, baseSlots) : items;

  if (!data.stack) return searchItems.find((target) => target.name === undefined);

  const stackableSlot = searchItems.find(
    (target) => target.name === item.name && isEqual(target.metadata, item.metadata)
  );

  return stackableSlot || searchItems.find((target) => target.name === undefined);
};

export const getTargetInventory = (
  state: State,
  sourceType: Inventory['type'],
  targetType?: Inventory['type']
): { sourceInventory: Inventory; targetInventory: Inventory } => ({
  sourceInventory: sourceType === InventoryType.PLAYER ? state.leftInventory : state.rightInventory,
  targetInventory: targetType
    ? targetType === InventoryType.PLAYER
      ? state.leftInventory
      : state.rightInventory
    : sourceType === InventoryType.PLAYER
    ? state.rightInventory
    : state.leftInventory,
});

export const itemDurability = (metadata: any, curTime: number) => {
  if (metadata?.durability === undefined) return;

  let durability = metadata.durability;

  if (durability > 100 && metadata.degrade)
    durability = ((metadata.durability - curTime) / (60 * metadata.degrade)) * 100;

  if (durability < 0) durability = 0;

  return durability;
};

export const getTotalWeight = (items: Inventory['items']) =>
  items.reduce((totalWeight, slot) => (isSlotWithItem(slot) ? totalWeight + slot.weight : totalWeight), 0);

export const isContainer = (inventory: Inventory) => inventory.type === InventoryType.CONTAINER;

export const getItemData = async (itemName: string) => {
  const resp: ItemData | null = await fetchNui('getItemData', itemName);

  if (resp?.name) {
    Items[itemName] = resp;
    return resp;
  }
};

export const getItemUrl = (item: string | SlotWithItem) => {
  const isObj = typeof item === 'object';

  if (isObj) {
    if (!item.name) return;
    const metadata = item.metadata;
    if (metadata?.imageurl) return `${metadata.imageurl}`;
    if (metadata?.image) return `${imagepath}/${metadata.image}.png`;
  }

  const itemName = isObj ? (item.name as string) : item;
  const itemData = Items[itemName];

  if (!itemData) return `${imagepath}/${itemName}.png`;
  if (itemData.image) return itemData.image;

  itemData.image = `${imagepath}/${itemName}.png`;

  return itemData.image;
};

/**
 * Cek apakah item clothing cocok dengan clothing slot tertentu.
 * FIX BUG 1: dipakai di InventorySlot canDrop untuk clothing slot di grid.
 */
export const itemMatchesClothingSlot = (
  item: SlotWithItem,
  clothingSlotIndex: number // 0-based index dari baseSlots
): boolean => {
  // Urutan harus sama persis dengan CLOTHING_SLOT_ORDER di CharacterOutfit & sv_clothing
  const CLOTHING_SLOT_ORDER = [
    { category: 'clothes', componentId: 0  },
    { category: 'clothes', componentId: 1  },
    { category: 'clothes', componentId: 2  },
    { category: 'clothes', componentId: 3  },
    { category: 'clothes', componentId: 4  },
    { category: 'clothes', componentId: 5  },
    { category: 'clothes', componentId: 6  },
    { category: 'clothes', componentId: 7  },
    { category: 'clothes', componentId: 8  },
    { category: 'clothes', componentId: 9  },
    { category: 'clothes', componentId: 10 },
    { category: 'clothes', componentId: 11 },
    { category: 'props',   componentId: 0  },
    { category: 'props',   componentId: 1  },
    { category: 'props',   componentId: 2  },
    { category: 'props',   componentId: 6  },
    { category: 'props',   componentId: 7  },
  ];

  const slotDef = CLOTHING_SLOT_ORDER[clothingSlotIndex];
  if (!slotDef) return false;

  // Cek dari metadata item (paling akurat)
  const meta = item.metadata || {};
  if (meta.clothingCategory !== undefined || meta.clothingComponentId !== undefined) {
    if (!meta.clothingCategory) return false;
    if (meta.clothingCategory !== slotDef.category) return false;
    if (meta.clothingComponentId !== undefined) return Number(meta.clothingComponentId) === slotDef.componentId;
    return true;
  }

  // Fallback ke registry
  const reg = CLOTHING_ITEM_REGISTRY[item.name];
  if (reg) return reg.category === slotDef.category && reg.componentId === slotDef.componentId;

  return false;
};