import React, { useCallback, useRef } from 'react';
import { DragSource, Inventory, InventoryType, Slot, SlotWithItem } from '../../typings';
import { useDrag, useDragDropManager, useDrop } from 'react-dnd';
import { useAppDispatch, useAppSelector } from '../../store';
import WeightBar from '../utils/WeightBar';
import { onDrop } from '../../dnd/onDrop';
import { onBuy } from '../../dnd/onBuy';
import { Items } from '../../store/items';
import { canCraftItem, canPurchaseItem, getItemUrl, isSlotWithItem } from '../../helpers';
import { onUse } from '../../dnd/onUse';
import { Locale } from '../../store/locale';
import { onCraft } from '../../dnd/onCraft';
import useNuiEvent from '../../hooks/useNuiEvent';
import { ItemsPayload } from '../../reducers/refreshSlots';
import { closeTooltip, openTooltip } from '../../store/tooltip';
import { openContextMenu } from '../../store/contextMenu';
import { useMergeRefs } from '@floating-ui/react';
import { selectLeftInventory } from '../../store/inventory';
import {
  CLOTHING_ITEM_REGISTRY,
  CLOTHES_SLOTS,
  PROPS_SLOTS,
  ClothingSlotDef,
} from '../../typings/clothing';

const CLOTHING_SLOT_ORDER: Array<{ category: string; id: number }> = [
  { category: 'clothes', id: 0  },
  { category: 'clothes', id: 1  },
  { category: 'clothes', id: 2  },
  { category: 'clothes', id: 3  },
  { category: 'clothes', id: 4  },
  { category: 'clothes', id: 5  },
  { category: 'clothes', id: 6  },
  { category: 'clothes', id: 7  },
  { category: 'clothes', id: 8  },
  { category: 'clothes', id: 9  },
  { category: 'clothes', id: 10 },
  { category: 'clothes', id: 11 },
  { category: 'props',   id: 0  },
  { category: 'props',   id: 1  },
  { category: 'props',   id: 2  },
  { category: 'props',   id: 6  },
  { category: 'props',   id: 7  },
];

const DUMMY_ITEM_NAME = 'clothing_placeholder';

const getSlotDefForInvSlot = (invSlot: number, baseSlots: number): ClothingSlotDef | null => {
  const idx = invSlot - baseSlots - 1;
  if (idx < 0 || idx >= CLOTHING_SLOT_ORDER.length) return null;
  const { category, id } = CLOTHING_SLOT_ORDER[idx];
  const allSlots = [...CLOTHES_SLOTS, ...PROPS_SLOTS];
  return allSlots.find(s => s.category === category && s.id === id) ?? null;
};

const itemMatchesClothingSlot = (item: SlotWithItem, slotDef: ClothingSlotDef): boolean => {
  const meta    = item.metadata || {};
  const metaCat = meta.clothingCategory;
  const metaId  = meta.clothingComponentId;
  if (metaCat !== undefined || metaId !== undefined) {
    if (!metaCat) return false;
    if (metaCat !== slotDef.category) return false;
    if (metaId !== undefined) return Number(metaId) === slotDef.id;
    return true;
  }
  const reg = CLOTHING_ITEM_REGISTRY[item.name];
  if (reg) return reg.category === slotDef.category && reg.componentId === slotDef.id;
  return false;
};

interface SlotProps {
  inventoryId: Inventory['id'];
  inventoryType: Inventory['type'];
  inventoryGroups: Inventory['groups'];
  item: Slot;
}

const InventorySlot: React.ForwardRefRenderFunction<HTMLDivElement, SlotProps> = (
  { item, inventoryId, inventoryType, inventoryGroups },
  ref
) => {
  const manager  = useDragDropManager();
  const dispatch = useAppDispatch();
  const timerRef = useRef<number | null>(null);
  const leftInv  = useAppSelector(selectLeftInventory);

  const baseSlots      = leftInv.baseSlots ?? leftInv.slots;
  const isClothingSlot = inventoryType === InventoryType.PLAYER && item.slot > baseSlots;
  const slotDef        = isClothingSlot ? getSlotDefForInvSlot(item.slot, baseSlots) : null;
  const isDummySlot    = isClothingSlot && isSlotWithItem(item) && item.name === DUMMY_ITEM_NAME;

  // ── Hooks (semua harus di atas conditional return) ───────────────────────
  const canDrag = useCallback(() => {
    if (isDummySlot) return false;
    return canPurchaseItem(item, { type: inventoryType, groups: inventoryGroups }) && canCraftItem(item, inventoryType);
  }, [item, inventoryType, inventoryGroups, isDummySlot]);

  const [{ isDragging }, drag] = useDrag<DragSource, void, { isDragging: boolean }>(
    () => ({
      type: 'SLOT',
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
      item: () => {
        if (isDummySlot) return null;
        // Gunakan strict=false agar clothing items (bisa tidak punya weight) tetap bisa didrag
        if (!item.name) return null;
        return {
          inventory: inventoryType,
          item: { name: item.name, slot: item.slot },
          image: item?.name ? `url(${getItemUrl(item as SlotWithItem) || 'none'})` : undefined,
        };
      },
      canDrag,
    }),
    [inventoryType, item, isDummySlot]
  );

  const [{ isOver, canDrop }, drop] = useDrop<DragSource, void, { isOver: boolean; canDrop: boolean }>(
    () => ({
      accept: 'SLOT',
      collect: (monitor) => ({ isOver: monitor.isOver(), canDrop: monitor.canDrop() }),
      drop: (source) => {
        if (isDummySlot) return;
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
        if (isDummySlot) return false;
        if (source.item.slot === item.slot && source.inventory === inventoryType) return false;
        if (inventoryType === InventoryType.SHOP || inventoryType === InventoryType.CRAFTING) return false;

        // ── Clothing slot ────────────────────────────────────────────────
        if (isClothingSlot) {
          if (!slotDef) return false;
          if (source.inventory !== InventoryType.PLAYER) return false;
          // Tidak dari sesama clothing slot
          if (source.item.slot > baseSlots) return false;
          const sourceItem = leftInv.items[source.item.slot - 1];
          if (!isSlotWithItem(sourceItem)) return false;
          if (sourceItem.name === DUMMY_ITEM_NAME) return false;
          return itemMatchesClothingSlot(sourceItem, slotDef);
        }

        // ── Slot biasa ───────────────────────────────────────────────────
        if (source.inventory === InventoryType.PLAYER) {
          const sourceFromClothing = source.item.slot > baseSlots;
          if (sourceFromClothing) {
            // Dari clothing slot → slot biasa berisi item: BLOCK
            // hanya boleh ke slot kosong (unequip)
            if (isSlotWithItem(item)) return false;
          }
        }

        return true;
      },
    }),
    [inventoryType, item, isClothingSlot, slotDef, baseSlots, leftInv, isDummySlot]
  );

  useNuiEvent('refreshSlots', (data: { items?: ItemsPayload | ItemsPayload[] }) => {
    if (!isDragging && !data.items) return;
    if (!Array.isArray(data.items)) return;
    const itemSlot = data.items.find(
      (dataItem) => dataItem.item.slot === item.slot && dataItem.inventory === inventoryId
    );
    if (!itemSlot) return;
    manager.dispatch({ type: 'dnd-core/END_DRAG' });
  });

  const connectRef = (element: HTMLDivElement) => drag(drop(element));
  const refs       = useMergeRefs([connectRef, ref]);

  const getSlotBorder = () => {
    if (isOver && (isClothingSlot || isDummySlot)) {
      return canDrop
        ? '1px dashed rgba(79,195,247,0.8)'
        : '1px dashed rgba(239,83,80,0.8)';
    }
    if (isOver) return '1px dashed rgba(255,255,255,0.4)';
    if (isClothingSlot || isDummySlot) return '1px dashed rgba(255,255,255,0.12)';
    return '';
  };

  // ── Dummy: tampil sebagai slot kosong dengan icon ────────────────────────
  if (isDummySlot) {
    return (
      <div
        ref={refs}
        className="inventory-slot"
        style={{
          backgroundImage: 'none',
          border: getSlotBorder(),
          backgroundColor: 'rgba(79,195,247,0.03)',
          cursor: 'default',
        }}
      >
        {slotDef && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 18, opacity: 0.2 }}>{slotDef.icon}</span>
          </div>
        )}
        {isOver && <div className="cslot-hint">{canDrop ? '▼' : '✗'}</div>}
      </div>
    );
  }

  // ── Normal slot ──────────────────────────────────────────────────────────
  const handleContext = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (inventoryType !== 'player' || !isSlotWithItem(item)) return;
    dispatch(openContextMenu({ item, coords: { x: event.clientX, y: event.clientY } }));
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    dispatch(closeTooltip());
    if (timerRef.current) clearTimeout(timerRef.current);
    if (event.ctrlKey && isSlotWithItem(item) && inventoryType !== 'shop' && inventoryType !== 'crafting') {
      onDrop({ item: item, inventory: inventoryType });
    } else if (event.altKey && isSlotWithItem(item) && inventoryType === 'player') {
      onUse(item);
    }
  };

  return (
    <div
      ref={refs}
      onContextMenu={handleContext}
      onClick={handleClick}
      className="inventory-slot"
      style={{
        filter:
          !canPurchaseItem(item, { type: inventoryType, groups: inventoryGroups }) || !canCraftItem(item, inventoryType)
            ? 'brightness(80%) grayscale(100%)'
            : undefined,
        opacity: isDragging ? 0.4 : 1.0,
        backgroundImage: `url(${item?.name ? getItemUrl(item as SlotWithItem) : 'none'}`,
        border: getSlotBorder(),
        backgroundColor: isClothingSlot && !isSlotWithItem(item)
          ? 'rgba(79,195,247,0.03)'
          : undefined,
      }}
    >
      {isSlotWithItem(item) && (
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
          <div className={inventoryType === 'player' && item.slot <= 5 ? 'item-hotslot-header-wrapper' : 'item-slot-header-wrapper'}>
            {inventoryType === 'player' && item.slot <= 5 && <div className="inventory-slot-number">{item.slot}</div>}
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
                      style={{
                        imageRendering: '-webkit-optimize-contrast',
                        height: 'auto',
                        width: '2vh',
                        backfaceVisibility: 'hidden',
                        transform: 'translateZ(0)',
                      }}
                    />
                    <p>{item.price.toLocaleString('en-us')}</p>
                  </div>
                ) : (
                  <>
                    {item.price > 0 && (
                      <div
                        className="item-slot-price-wrapper"
                        style={{ color: item.currency === 'money' || !item.currency ? '#2ECC71' : '#E74C3C' }}
                      >
                        <p>{Locale.$ || '$'}{item.price.toLocaleString('en-us')}</p>
                      </div>
                    )}
                  </>
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

      {isClothingSlot && !isSlotWithItem(item) && slotDef && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 18, opacity: 0.2 }}>{slotDef.icon}</span>
        </div>
      )}
    </div>
  );
};

export default React.memo(React.forwardRef(InventorySlot));