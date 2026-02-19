import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { getItemData, itemDurability } from '../helpers';
import { Items } from '../store/items';
import { Inventory, State } from '../typings';

const CLOTHING_SLOT_COUNT = 17; // 12 clothes + 5 props

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

    let baseSlots: number;

    if (!isPlayer) {
      // Non-player inventory: tidak ada clothing slots
      baseSlots = leftInventory.slots;
    } else if (leftInventory.baseSlots != null) {
      // Server sudah kirim baseSlots secara eksplisit — pakai itu
      baseSlots = leftInventory.baseSlots;
    } else if (leftInventory.slots > CLOTHING_SLOT_COUNT) {
      // Server kirim total slots (base + clothing) — hitung baseSlots
      // Asumsi: kalau slots > 17, kemungkinan sudah include clothing slots
      // Tapi ini tidak reliable, lebih baik server selalu kirim baseSlots
      baseSlots = leftInventory.slots - CLOTHING_SLOT_COUNT;
    } else {
      baseSlots = leftInventory.slots;
    }

    // Total array selalu base + clothing agar slot clothing bisa disimpan
    const totalSlots = isPlayer ? baseSlots + CLOTHING_SLOT_COUNT : baseSlots;

    state.leftInventory = {
      ...leftInventory,
      baseSlots: isPlayer ? baseSlots : undefined,
      slots: totalSlots,
      items: Array.from(Array(totalSlots), (_, index) => {
        const item = Object.values(leftInventory.items).find((item) => item?.slot === index + 1) || {
          slot: index + 1,
        };

        if (!item.name) return item;

        if (typeof Items[item.name] === 'undefined') {
          getItemData(item.name);
        }

        item.durability = itemDurability(item.metadata, curTime);
        return item;
      }),
    };
  }

  if (rightInventory)
    state.rightInventory = {
      ...rightInventory,
      items: Array.from(Array(rightInventory.slots), (_, index) => {
        const item = Object.values(rightInventory.items).find((item) => item?.slot === index + 1) || {
          slot: index + 1,
        };

        if (!item.name) return item;

        if (typeof Items[item.name] === 'undefined') {
          getItemData(item.name);
        }

        item.durability = itemDurability(item.metadata, curTime);
        return item;
      }),
    };

  state.shiftPressed = false;
  state.isBusy = false;
};