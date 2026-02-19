import { canStack, findAvailableSlot, getTargetInventory, isSlotWithItem } from '../helpers';
import { validateMove } from '../thunks/validateItems';
import { store } from '../store';
import { DragSource, DropTarget, InventoryType, SlotWithItem } from '../typings';
import { moveSlots, stackSlots, swapSlots } from '../store/inventory';
import { Items } from '../store/items';
import { CLOTHING_ITEM_REGISTRY } from '../typings/clothing';

const DUMMY_ITEM_NAME = 'clothing_placeholder';

function isClothingItem(name: string, metadata?: Record<string, any>): boolean {
  if (!name || name === DUMMY_ITEM_NAME) return false;
  if (metadata?.clothingCategory !== undefined) return true;
  return !!CLOTHING_ITEM_REGISTRY[name];
}

export const onDrop = (source: DragSource, target?: DropTarget) => {
  const { inventory: state } = store.getState();
  const { sourceInventory, targetInventory } = getTargetInventory(state, source.inventory, target?.inventory);
  const sourceSlot = sourceInventory.items[source.item.slot - 1] as SlotWithItem;

  if (sourceSlot.name === DUMMY_ITEM_NAME) return;

  if (sourceSlot.metadata?.container !== undefined) {
    if (targetInventory.type === InventoryType.CONTAINER)
      return console.log(`Cannot store container inside another container`);
    if (state.rightInventory.id === sourceSlot.metadata.container)
      return console.log(`Cannot move container when opened`);
  }

  const leftInv   = state.leftInventory;
  const baseSlots = leftInv.type === 'player' ? (leftInv.baseSlots ?? leftInv.slots) : undefined;

  // Tentukan apakah source/target adalah clothing slot
  const srcIsClothSlot = baseSlots !== undefined && sourceInventory.type === 'player' && source.item.slot > baseSlots;
  const tgtIsClothSlot = baseSlots !== undefined && target !== undefined && targetInventory.type === 'player' && target.item.slot > baseSlots;

  // EQUIP (base → clothing slot): sepenuhnya di-handle oleh CharacterOutfit via fetchNui('equipClothing')
  // Server yang gerakkan item di DB dan refresh React → kita SKIP semua processing di sini
  if (tgtIsClothSlot) return;

  // UNEQUIP via drag (clothing slot → base): tetap proses di sini
  // Guard: jangan drop clothing slot ke slot berisi item biasa
  if (srcIsClothSlot && target) {
    const t = targetInventory.items[target.item.slot - 1];
    if (isSlotWithItem(t) && t.name !== DUMMY_ITEM_NAME) return;
  }

  const targetBaseSlots = targetInventory.type === 'player'
    ? (targetInventory.baseSlots ?? targetInventory.slots) : undefined;

  const sourceData = Items[sourceSlot.name];

  const targetSlot = target
    ? targetInventory.items[target.item.slot - 1]
    : sourceData
      ? findAvailableSlot(sourceSlot, sourceData, targetInventory.items, targetBaseSlots)
      : undefined;

  if (targetSlot === undefined) return;
  if (targetSlot.metadata?.container !== undefined && state.rightInventory.id === targetSlot.metadata.container) return;

  const count =
    state.shiftPressed && sourceSlot.count > 1 && sourceInventory.type !== 'shop'
      ? Math.floor(sourceSlot.count / 2)
      : state.itemAmount === 0 || state.itemAmount > sourceSlot.count
      ? sourceSlot.count
      : state.itemAmount;

  const data = {
    fromSlot: sourceSlot,
    toSlot:   targetSlot,
    fromType: sourceInventory.type,
    toType:   targetInventory.type,
    count,
  };

  const targetIsDummy = isSlotWithItem(targetSlot) && targetSlot.name === DUMMY_ITEM_NAME;

  // Update Redux state (optimistic UI)
  if (!targetIsDummy && isSlotWithItem(targetSlot, true)) {
    if (sourceData?.stack && canStack(sourceSlot, targetSlot)) {
      store.dispatch(stackSlots({ ...data, toSlot: targetSlot }));
    } else {
      store.dispatch(swapSlots({ ...data, toSlot: targetSlot }));
    }
  } else {
    store.dispatch(moveSlots(data));
  }

  // Skip validateMove untuk shop/crafting dan drop ke dummy
  if (targetIsDummy) return;
  if (source.inventory === InventoryType.SHOP) return;
  if (source.inventory === InventoryType.CRAFTING) return;

  // Semua perpindahan normal (termasuk clothing slot → base via drag di InventorySlot)
  // → validateMove → swapItems → DB diupdate
  store.dispatch(
    validateMove({
      fromSlot: sourceSlot.slot,
      fromType: sourceInventory.type,
      toSlot:   targetSlot.slot,
      toType:   targetInventory.type,
      count,
    })
  );
};