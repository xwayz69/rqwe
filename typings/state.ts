import { Inventory } from './inventory';

export type State = {
  leftInventory: Inventory;
  rightInventory: Inventory;
  clothingInventory: Inventory | null;
  itemAmount: number;
  shiftPressed: boolean;
  isBusy: boolean;
  additionalMetadata: Array<{ metadata: string; value: string }>;
  history?: {
    leftInventory: Inventory;
    rightInventory: Inventory;
  };
};