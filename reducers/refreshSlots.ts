import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { itemDurability } from '../helpers';
import { inventorySlice } from '../store/inventory';
import { Items } from '../store/items';
import { InventoryType, Slot, State } from '../typings';
import { CLOTHING_ITEM_REGISTRY, ClothingItemInfo } from '../typings/clothing';

export type ItemsPayload = { item: Slot; inventory?: InventoryType };

interface Payload {
  items?:      ItemsPayload | ItemsPayload[];
  itemCount?:  Record<string, number>;
  weightData?: { inventoryId: string; maxWeight: number };
  slotsData?:  { inventoryId: string; slots: number };
}

// Urutan slot — HARUS sama dengan sv_clothing.lua
const SLOT_ORDER: Array<{ category: string; componentId: number }> = [
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

function getClothingInfo(
  itemName: string,
  metadata?: Record<string, any>
): { category: string; componentId: number } | null {
  if (!itemName || itemName === 'clothing_placeholder') return null;

  if (
    metadata?.clothingCategory !== undefined &&
    metadata?.clothingComponentId !== undefined
  ) {
    return {
      category:    metadata.clothingCategory,
      componentId: Number(metadata.clothingComponentId),
    };
  }

  const reg = CLOTHING_ITEM_REGISTRY[itemName] as ClothingItemInfo | undefined;
  if (reg) return { category: reg.category, componentId: reg.componentId };

  return null;
}

function itemMatchesSlot(
  itemName: string,
  metadata: Record<string, any> | undefined,
  slotOrderIndex: number
): boolean {
  const def = SLOT_ORDER[slotOrderIndex];
  if (!def) return false;
  if (itemName === 'clothing_placeholder') return true;

  const info = getClothingInfo(itemName, metadata);
  if (!info) return false;

  return info.category === def.category && info.componentId === def.componentId;
}

function notifyInvalidItem(data: {
  slot: number;
  itemName: string;
  count: number;
  metadata: Record<string, any>;
}) {
  if (!(window as any).invokeNative) return;
  fetch(`https://ox_inventory/notifyInvalidClothingItem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {});
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

export const refreshSlotsReducer: CaseReducer<State, PayloadAction<Payload>> = (state, action) => {
  if (action.payload.items) {
    if (!Array.isArray(action.payload.items)) {
      action.payload.items = [action.payload.items];
    }
    const curTime = Math.floor(Date.now() / 1000);

    for (const data of Object.values(action.payload.items).filter(Boolean)) {
      const targetInventory = data.inventory
        ? data.inventory !== InventoryType.PLAYER
          ? state.rightInventory
          : state.leftInventory
        : state.leftInventory;

      const item      = data.item;
      const slotNum   = item.slot;
      const baseSlots = targetInventory.type === 'player'
        ? (targetInventory.baseSlots ?? targetInventory.slots)
        : targetInventory.slots;

      const isClothingSlot = targetInventory.type === 'player' && slotNum > baseSlots;

      // ── Validasi clothing slot ────────────────────────────────────────
      if (isClothingSlot && item.name) {
        const isDummy        = item.name === 'clothing_placeholder';
        const meta           = (item as any).metadata || {};
        const slotOrderIndex = slotNum - baseSlots - 1;

        if (!isDummy && !itemMatchesSlot(item.name, meta, slotOrderIndex)) {
          const slotDef = SLOT_ORDER[slotOrderIndex];
          console.warn(
            `[refreshSlots] ❌ INVALID: "${item.name}" di slot ${slotNum}` +
            ` (expected ${slotDef?.category}/${slotDef?.componentId}) → dihapus`
          );

          targetInventory.items[slotNum - 1] = { slot: slotNum };

          notifyInvalidItem({
            slot:     slotNum,
            itemName: item.name,
            count:    (item as any).count ?? 1,
            metadata: meta,
          });

          continue; // skip update slot ini
        }
      }

      // ── Update normal ─────────────────────────────────────────────────
      item.durability = itemDurability((item as any).metadata, curTime);
      targetInventory.items[slotNum - 1] = item;
    }

    if (state.rightInventory.type === InventoryType.CRAFTING) {
      state.rightInventory = { ...state.rightInventory };
    }
  }

  if (action.payload.itemCount) {
    for (const [itemName, count] of Object.entries(action.payload.itemCount)) {
      if (Items[itemName]) {
        Items[itemName]!.count += count;
      }
    }
  }

  if (action.payload.weightData) {
    const { inventoryId, maxWeight } = action.payload.weightData;
    const inv =
      inventoryId === state.leftInventory.id  ? 'leftInventory'  :
      inventoryId === state.rightInventory.id ? 'rightInventory' : null;
    if (inv) state[inv].maxWeight = maxWeight;
  }

  if (action.payload.slotsData) {
    const { inventoryId, slots } = action.payload.slotsData;
    const inv =
      inventoryId === state.leftInventory.id  ? 'leftInventory'  :
      inventoryId === state.rightInventory.id ? 'rightInventory' : null;

    if (!inv) return;

    state[inv].slots = slots;
    inventorySlice.caseReducers.setupInventory(state, {
      type:    'setupInventory',
      payload: {
        leftInventory:  inv === 'leftInventory'  ? state[inv] : undefined,
        rightInventory: inv === 'rightInventory' ? state[inv] : undefined,
      },
    });
  }
};