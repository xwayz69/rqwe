import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { getItemData, itemDurability } from '../helpers';
import { Items } from '../store/items';
import { Inventory, State } from '../typings';
import { CLOTHING_ITEM_REGISTRY, ClothingItemInfo } from '../typings/clothing';

const CLOTHING_SLOT_COUNT = 17;

// Urutan slot — HARUS sama persis dengan sv_clothing.lua CLOTHING_SLOT_ORDER
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

// ─── Helper: Dapatkan clothing info dari item ─────────────────────────────────

function getClothingInfo(
  itemName: string,
  metadata?: Record<string, any>
): { category: string; componentId: number } | null {
  if (!itemName || itemName === 'clothing_placeholder') return null;

  // Prioritas 1: metadata eksplisit
  if (
    metadata?.clothingCategory !== undefined &&
    metadata?.clothingComponentId !== undefined
  ) {
    return {
      category:    metadata.clothingCategory,
      componentId: Number(metadata.clothingComponentId),
    };
  }

  // Prioritas 2: registry
  const reg = CLOTHING_ITEM_REGISTRY[itemName] as ClothingItemInfo | undefined;
  if (reg) return { category: reg.category, componentId: reg.componentId };

  return null;
}

// Cek apakah item cocok untuk slotOrderIndex (0-based dalam SLOT_ORDER)
function itemMatchesSlot(
  itemName: string,
  metadata: Record<string, any> | undefined,
  slotOrderIndex: number
): boolean {
  const def = SLOT_ORDER[slotOrderIndex];
  if (!def) return false;
  if (itemName === 'clothing_placeholder') return true; // dummy selalu valid

  const info = getClothingInfo(itemName, metadata);
  if (!info) return false;

  return info.category === def.category && info.componentId === def.componentId;
}

// ─── Notify server: item tidak valid di clothing slot ─────────────────────────
// Karena clothing resource terpisah dari ox_inventory, React tidak bisa
// fetchNui langsung ke clothing resource. Solusi: trigger server event via
// NUI message yang diteruskan ke server oleh ox_inventory.
// Di ox_inventory/server.lua tambahkan:
//   RegisterNUICallback('notifyInvalidClothingItem', function(data, cb)
//     TriggerEvent('ox_clothing:removeInvalidItem', tonumber(source), data)
//     cb({})
//   end)

function notifyInvalidItem(data: {
  slot: number;
  itemName: string;
  count: number;
  metadata: Record<string, any>;
}) {
  // Coba lewat NUI fetch ke ox_inventory sebagai relay
  if (!(window as any).invokeNative) return; // browser dev mode, skip
  fetch(`https://ox_inventory/notifyInvalidClothingItem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {});
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

export const setupInventoryReducer: CaseReducer<
  State,
  PayloadAction<{
    leftInventory?: Inventory;
    rightInventory?: Inventory;
  }>
> = (state, action) => {
  const { leftInventory, rightInventory } = action.payload;
  const curTime = Math.floor(Date.now() / 1000);

  if (leftInventory) {
    const isPlayer = leftInventory.type === 'player';

    // ── Hitung baseSlots ──────────────────────────────────────────────────
    let baseSlots: number;
    if (!isPlayer) {
      baseSlots = leftInventory.slots;
    } else if (leftInventory.baseSlots != null) {
      baseSlots = leftInventory.baseSlots;
    } else if (leftInventory.slots > CLOTHING_SLOT_COUNT) {
      baseSlots = leftInventory.slots - CLOTHING_SLOT_COUNT;
    } else {
      baseSlots = leftInventory.slots;
    }

    const totalSlots = isPlayer ? baseSlots + CLOTHING_SLOT_COUNT : baseSlots;

    // ── Build items array dengan validasi clothing slot ───────────────────
    const items = Array.from(Array(totalSlots), (_, index) => {
      const slotNum         = index + 1;
      const isClothingSlot  = isPlayer && slotNum > baseSlots;
      const slotOrderIndex  = slotNum - baseSlots - 1; // 0-based

      const raw = Object.values(leftInventory.items).find(
        (it) => it?.slot === slotNum
      );

      // ── Validasi item di clothing slot ──────────────────────────────
      if (isClothingSlot && raw?.name) {
        const isDummy = raw.name === 'clothing_placeholder';
        const meta    = (raw as any).metadata || {};

        if (!isDummy) {
          const valid = itemMatchesSlot(raw.name, meta, slotOrderIndex);

          if (!valid) {
            const slotDef = SLOT_ORDER[slotOrderIndex];
            console.warn(
              `[setupInventory] ❌ INVALID: "${raw.name}" di clothing slot ${slotNum}` +
              ` (expected ${slotDef?.category}/${slotDef?.componentId}) → dihapus dari state`
            );

            // Beritahu server untuk fix
            notifyInvalidItem({
              slot:     slotNum,
              itemName: raw.name,
              count:    (raw as any).count ?? 1,
              metadata: meta,
            });

            // Kosongkan slot di state React
            return { slot: slotNum };
          }
        }
      }

      // ── Item normal ─────────────────────────────────────────────────
      const item = raw || { slot: slotNum };
      if (!item.name) return item;

      if (typeof Items[item.name] === 'undefined') {
        getItemData(item.name);
      }

      (item as any).durability = itemDurability((item as any).metadata, curTime);
      return item;
    });

    state.leftInventory = {
      ...leftInventory,
      baseSlots: isPlayer ? baseSlots : undefined,
      slots:     totalSlots,
      items,
    };
  }

  // ── Right inventory ──────────────────────────────────────────────────────
  if (rightInventory) {
    state.rightInventory = {
      ...rightInventory,
      items: Array.from(Array(rightInventory.slots), (_, index) => {
        const slotNum = index + 1;
        const item    = Object.values(rightInventory.items).find(
          (it) => it?.slot === slotNum
        ) || { slot: slotNum };

        if (!item.name) return item;

        if (typeof Items[item.name] === 'undefined') {
          getItemData(item.name);
        }

        (item as any).durability = itemDurability((item as any).metadata, curTime);
        return item;
      }),
    };
  }

  state.shiftPressed = false;
  state.isBusy       = false;
};