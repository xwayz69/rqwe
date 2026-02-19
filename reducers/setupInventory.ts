import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { getItemData, itemDurability } from '../helpers';
import { Items } from '../store/items';
import { Inventory, State } from '../typings';

const CLOTHING_SLOT_COUNT = 17; // 12 clothes + 5 props
const RESERVED_ITEM = 'clothing_reserved';

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
      baseSlots = leftInventory.slots;
    } else if (leftInventory.baseSlots != null) {
      baseSlots = leftInventory.baseSlots;
    } else if (leftInventory.slots > CLOTHING_SLOT_COUNT) {
      baseSlots = leftInventory.slots - CLOTHING_SLOT_COUNT;
    } else {
      baseSlots = leftInventory.slots;
    }

    const totalSlots = isPlayer ? baseSlots + CLOTHING_SLOT_COUNT : baseSlots;

    state.leftInventory = {
      ...leftInventory,
      baseSlots: isPlayer ? baseSlots : undefined,
      slots: totalSlots,
      items: Array.from(Array(totalSlots), (_, index) => {
        const slotNum = index + 1;
        const item = Object.values(leftInventory.items).find((item) => item?.slot === slotNum) || {
          slot: slotNum,
        };

        if (!item.name) return item;

        // DEBUG: clothing_reserved ditampilkan di base slots (temporary)
        // if (item.name === RESERVED_ITEM && slotNum <= baseSlots) {
        //   return { slot: slotNum };
        // }

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