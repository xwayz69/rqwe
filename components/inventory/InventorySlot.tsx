import React, { useCallback, useRef } from 'react';
import { DragSource, Inventory, InventoryType, Slot, SlotWithItem } from '../../typings';
import { useDrag, useDragDropManager, useDrop } from 'react-dnd';
import { useAppDispatch, useAppSelector } from '../../store';
import WeightBar from '../utils/WeightBar';
import { onDrop } from '../../dnd/onDrop';
import { onBuy } from '../../dnd/onBuy';
import { Items } from '../../store/items';
import { canCraftItem, canPurchaseItem, getItemUrl, isSlotWithItem, itemMatchesClothingSlot } from '../../helpers';
import { onUse } from '../../dnd/onUse';
import { Locale } from '../../store/locale';
import { onCraft } from '../../dnd/onCraft';
import useNuiEvent from '../../hooks/useNuiEvent';
import { ItemsPayload } from '../../reducers/refreshSlots';
import { closeTooltip, openTooltip } from '../../store/tooltip';
import { openContextMenu } from '../../store/contextMenu';
import { useMergeRefs } from '@floating-ui/react';
import { selectLeftInventory } from '../../store/inventory';

const SLOT_TYPE_NORMAL   = 'SLOT';
const SLOT_TYPE_CLOTHING = 'SLOT_CLOTHING';

// Item placeholder yang dipakai server untuk reserve clothing slot
// Slot dengan item ini diperlakukan sebagai KOSONG secara visual
const RESERVED_ITEM = 'clothing_reserved';

interface SlotProps {
  inventoryId: Inventory['id'];
  inventoryType: Inventory['type'];
  inventoryGroups: Inventory['groups'];
  item: Slot;
  clothingSlotInfo?: { icon: string; label: string };
}

const InventorySlot: React.ForwardRefRenderFunction<HTMLDivElement, SlotProps> = (
  { item, inventoryId, inventoryType, inventoryGroups, clothingSlotInfo },
  ref
) => {
  const manager       = useDragDropManager();
  const dispatch      = useAppDispatch();
  const timerRef      = useRef<number | null>(null);
  const leftInventory = useAppSelector(selectLeftInventory);

  const isClothingSlot  = !!clothingSlotInfo;
  const baseSlots        = leftInventory.baseSlots ?? leftInventory.slots;
  const clothingSlotIndex = isClothingSlot ? item.slot - 1 - baseSlots : -1;

  // Treat item clothing_reserved sebagai slot kosong secara visual
  const isReservedItem = (item as SlotWithItem)?.name === RESERVED_ITEM;
  const visuallyEmpty  = !isSlotWithItem(item) || isReservedItem;

  const dragType = isClothingSlot ? SLOT_TYPE_CLOTHING : SLOT_TYPE_NORMAL;

  const canDrag = useCallback(() => {
    if (isReservedItem) return false; // placeholder tidak bisa di-drag
    return canPurchaseItem(item, { type: inventoryType, groups: inventoryGroups }) && canCraftItem(item, inventoryType);
  }, [item, inventoryType, inventoryGroups, isReservedItem]);

  const [{ isDragging }, drag] = useDrag<DragSource, void, { isDragging: boolean }>(
    () => ({
      type: dragType,
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
      item: () => {
        if (isReservedItem) return null;
        return isSlotWithItem(item, inventoryType !== InventoryType.SHOP)
          ? {
              inventory: inventoryType,
              item: { name: item.name, slot: item.slot },
              image: item?.name && `url(${getItemUrl(item) || 'none'}`,
            }
          : null;
      },
      canDrag,
    }),
    [inventoryType, item, dragType, isReservedItem]
  );

  // ── Clothing slot: hanya terima SLOT_NORMAL yang cocok ──────────────────────
  const [clothingDropState, clothingDrop] = useDrop<DragSource, void, { isOver: boolean; canDrop: boolean }>(
    () => ({
      accept: SLOT_TYPE_NORMAL,
      collect: (monitor) => ({ isOver: monitor.isOver(), canDrop: monitor.canDrop() }),
      canDrop: (source) => {
        if (source.inventory !== InventoryType.PLAYER) return false;
        if (source.item.slot > baseSlots) return false;
        const srcItem = leftInventory.items[source.item.slot - 1];
        if (!isSlotWithItem(srcItem)) return false;
        return itemMatchesClothingSlot(srcItem, clothingSlotIndex);
      },
      drop: (source) => {
        dispatch(closeTooltip());
        onDrop(source, { inventory: inventoryType, item: { slot: item.slot } });
      },
    }),
    [inventoryType, item, clothingSlotIndex, baseSlots, leftInventory]
  );

  // ── Slot biasa: hanya terima SLOT_NORMAL ────────────────────────────────────
  const [normalDropState, normalDrop] = useDrop<DragSource, void, { isOver: boolean; canDrop: boolean }>(
    () => ({
      accept: SLOT_TYPE_NORMAL,
      collect: (monitor) => ({ isOver: monitor.isOver(), canDrop: monitor.canDrop() }),
      drop: (source) => {
        dispatch(closeTooltip());
        switch (source.inventory) {
          case InventoryType.SHOP:
            onBuy(source, { inventory: inventoryType, item: { slot: item.slot } });
            break;
          case InventoryType.CRAFTING:
            onCraft(source, { inventory: inventoryType, item: { slot: item.slot } });
            break;
          default:
            onDrop(source, { inventory: inventoryType, item: { slot: item.slot } });
            break;
        }
      },
      canDrop: (source) => {
        if (source.item.slot === item.slot && source.inventory === inventoryType) return false;
        if (inventoryType === InventoryType.SHOP || inventoryType === InventoryType.CRAFTING) return false;
        return true;
      },
    }),
    [inventoryType, item]
  );

  useNuiEvent('refreshSlots', (data: { items?: ItemsPayload | ItemsPayload[] }) => {
    if (!isDragging && !data.items) return;
    if (!Array.isArray(data.items)) return;
    const itemSlot = data.items.find(
      (d) => d.item.slot === item.slot && d.inventory === inventoryId
    );
    if (!itemSlot) return;
    manager.dispatch({ type: 'dnd-core/END_DRAG' });
  });

  const connectRef = isClothingSlot
    ? (el: HTMLDivElement) => drag(clothingDrop(el))
    : (el: HTMLDivElement) => drag(normalDrop(el));

  const refs = useMergeRefs([connectRef, ref]);

  const dropState     = isClothingSlot ? clothingDropState : normalDropState;
  const { isOver, canDrop } = dropState;

  const handleContext = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (isReservedItem) return; // jangan buka context menu untuk reserved
    if (inventoryType !== 'player' || !isSlotWithItem(item)) return;
    dispatch(openContextMenu({ item, coords: { x: event.clientX, y: event.clientY } }));
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isReservedItem) return;
    dispatch(closeTooltip());
    if (timerRef.current) clearTimeout(timerRef.current);
    if (event.ctrlKey && isSlotWithItem(item) && inventoryType !== 'shop' && inventoryType !== 'crafting') {
      onDrop({ item: item, inventory: inventoryType });
    } else if (event.altKey && isSlotWithItem(item) && inventoryType === 'player') {
      onUse(item);
    }
  };

  const borderOverride = isOver
    ? canDrop
      ? '1px dashed rgba(46, 204, 113, 0.8)'
      : '1px dashed rgba(231, 76, 60, 0.8)'
    : undefined;

  // Background image — reserved item tidak tampilkan gambar
  const bgImage = visuallyEmpty
    ? 'none'
    : `url(${getItemUrl(item as SlotWithItem)})`;

  return (
    <div
      ref={refs}
      onContextMenu={handleContext}
      onClick={handleClick}
      className={`inventory-slot${isClothingSlot ? ' inventory-slot--clothing' : ''}`}
      style={{
        filter:
          !isReservedItem &&
          (!canPurchaseItem(item, { type: inventoryType, groups: inventoryGroups }) ||
            !canCraftItem(item, inventoryType))
            ? 'brightness(80%) grayscale(100%)'
            : undefined,
        opacity: isDragging ? 0.4 : 1.0,
        backgroundImage: bgImage,
        border: borderOverride,
      }}
    >
      {/* Badge clothing slot kosong / reserved — icon besar + label di tengah */}
      {isClothingSlot && visuallyEmpty && (
        <div className="clothing-slot-badge">
          <span className="clothing-slot-badge-icon">{clothingSlotInfo.icon}</span>
          <span className="clothing-slot-badge-label">{clothingSlotInfo.label}</span>
        </div>
      )}

      {/* Badge clothing slot ada item asli — icon kecil pojok kiri atas */}
      {isClothingSlot && !visuallyEmpty && (
        <div className="clothing-slot-badge clothing-slot-badge--filled">
          <span className="clothing-slot-badge-icon">{clothingSlotInfo.icon}</span>
        </div>
      )}

      {/* Render item wrapper HANYA jika bukan reserved */}
      {isSlotWithItem(item) && !isReservedItem && (
        <div
          className="item-slot-wrapper"
          onMouseEnter={() => {
            timerRef.current = window.setTimeout(() => {
              dispatch(openTooltip({ item, inventoryType }));
            }, 500) as unknown as number;
          }}
          onMouseLeave={() => {
            dispatch(closeTooltip());
            if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
          }}
        >
          <div
            className={
              inventoryType === 'player' && item.slot <= 5
                ? 'item-hotslot-header-wrapper'
                : 'item-slot-header-wrapper'
            }
          >
            {inventoryType === 'player' && item.slot <= 5 && (
              <div className="inventory-slot-number">{item.slot}</div>
            )}
            <div className="item-slot-info-wrapper">
              <p>
                {item.weight > 0
                  ? item.weight >= 1000
                    ? `${(item.weight / 1000).toLocaleString('en-us', { minimumFractionDigits: 2 })}kg `
                    : `${item.weight.toLocaleString('en-us', { minimumFractionDigits: 0 })}g `
                  : ''}
              </p>
              <p>{item.count ? item.count.toLocaleString('en-us') + `x` : ''}</p>
            </div>
          </div>
          <div>
            {inventoryType !== 'shop' && item?.durability !== undefined && (
              <WeightBar percent={item.durability} durability />
            )}
            {inventoryType === 'shop' && item?.price !== undefined && (
              <>
                {item?.currency !== 'money' && item.currency !== 'black_money' && item.price > 0 && item.currency ? (
                  <div className="item-slot-currency-wrapper">
                    <img
                      src={item.currency ? getItemUrl(item.currency) : 'none'}
                      alt="item-image"
                      style={{ imageRendering: '-webkit-optimize-contrast', height: 'auto', width: '2vh', backfaceVisibility: 'hidden', transform: 'translateZ(0)' }}
                    />
                    <p>{item.price.toLocaleString('en-us')}</p>
                  </div>
                ) : (
                  item.price > 0 && (
                    <div className="item-slot-price-wrapper" style={{ color: item.currency === 'money' || !item.currency ? '#2ECC71' : '#E74C3C' }}>
                      <p>{Locale.$ || '$'}{item.price.toLocaleString('en-us')}</p>
                    </div>
                  )
                )}
              </>
            )}
            <div className="inventory-slot-label-box">
              <div className="inventory-slot-label-text">
                {item.metadata?.label ? item.metadata.label : Items[item.name]?.label || item.name}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(React.forwardRef(InventorySlot));