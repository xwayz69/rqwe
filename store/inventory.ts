import { createSlice, current, isFulfilled, isPending, isRejected, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '.';
import {
  moveSlotsReducer,
  refreshSlotsReducer,
  setupInventoryReducer,
  stackSlotsReducer,
  swapSlotsReducer,
} from '../reducers';
import { Inventory, State } from '../typings';

const initialState: State = {
  leftInventory: {
    id: '',
    type: '',
    slots: 0,
    maxWeight: 0,
    items: [],
  },
  rightInventory: {
    id: '',
    type: '',
    slots: 0,
    maxWeight: 0,
    items: [],
  },
  clothingInventory: null,
  additionalMetadata: new Array(),
  itemAmount: 0,
  shiftPressed: false,
  isBusy: false,
};

export const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    stackSlots: stackSlotsReducer,
    swapSlots: swapSlotsReducer,
    setupInventory: setupInventoryReducer,
    moveSlots: moveSlotsReducer,
    refreshSlots: refreshSlotsReducer,
    setAdditionalMetadata: (state, action: PayloadAction<Array<{ metadata: string; value: string }>>) => {
      const metadata = [];
      for (let i = 0; i < action.payload.length; i++) {
        const entry = action.payload[i];
        if (!state.additionalMetadata.find((el) => el.value === entry.value)) metadata.push(entry);
      }
      state.additionalMetadata = [...state.additionalMetadata, ...metadata];
    },
    setItemAmount: (state, action: PayloadAction<number>) => {
      state.itemAmount = action.payload;
    },
    setShiftPressed: (state, action: PayloadAction<boolean>) => {
      state.shiftPressed = action.payload;
    },
    setContainerWeight: (state, action: PayloadAction<number>) => {
      const container = state.leftInventory.items.find((item) => item.metadata?.container === state.rightInventory.id);
      if (!container) return;
      container.weight = action.payload;
    },
    // Setup clothing inventory terpisah dari server stash
    setupClothingInventory: (state, action: PayloadAction<Inventory | null>) => {
      if (!action.payload) {
        state.clothingInventory = null;
        return;
      }
      const inv = action.payload;
      const curTime = Math.floor(Date.now() / 1000);
      state.clothingInventory = {
        ...inv,
        items: Array.from(Array(inv.slots), (_, index) => {
          const item = Object.values(inv.items).find((item) => item?.slot === index + 1) || {
            slot: index + 1,
          };
          return item;
        }),
      };
    },
    // Refresh single slot di clothing inventory
    refreshClothingSlot: (state, action: PayloadAction<{ slot: number; item: any }>) => {
      if (!state.clothingInventory) return;
      const { slot, item } = action.payload;
      if (slot < 1 || slot > state.clothingInventory.slots) return;
      state.clothingInventory.items[slot - 1] = item || { slot };
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(isPending, (state) => {
      state.isBusy = true;
      state.history = {
        leftInventory: current(state.leftInventory),
        rightInventory: current(state.rightInventory),
      };
    });
    builder.addMatcher(isFulfilled, (state) => {
      state.isBusy = false;
    });
    builder.addMatcher(isRejected, (state) => {
      if (state.history && state.history.leftInventory && state.history.rightInventory) {
        state.leftInventory = state.history.leftInventory;
        state.rightInventory = state.history.rightInventory;
      }
      state.isBusy = false;
    });
  },
});

export const {
  setAdditionalMetadata,
  setItemAmount,
  setShiftPressed,
  setupInventory,
  swapSlots,
  moveSlots,
  stackSlots,
  refreshSlots,
  setContainerWeight,
  setupClothingInventory,
  refreshClothingSlot,
} = inventorySlice.actions;

export const selectLeftInventory      = (state: RootState) => state.inventory.leftInventory;
export const selectRightInventory     = (state: RootState) => state.inventory.rightInventory;
export const selectClothingInventory  = (state: RootState) => state.inventory.clothingInventory;
export const selectItemAmount         = (state: RootState) => state.inventory.itemAmount;
export const selectIsBusy             = (state: RootState) => state.inventory.isBusy;

export default inventorySlice.reducer;