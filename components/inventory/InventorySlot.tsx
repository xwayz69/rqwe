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

// Urutan clothing slot — harus sama dengan CharacterOutfit.tsx & sv_clothing.lua
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

/**
 * Cek apakah item cocok untuk clothing slot tertentu.
 * Slot index dihitung dari: clothingSlotIndex = itemSlot - baseSlots - 1
 */
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
  const manager     = useDragDropManager();
  const dispatch    = useAppDispatch();
  const timerRef    = useRef<number | null>(null);
  const leftInv     = useAppSelector(selectLeftInventory);

  const baseSlots   = leftInv.baseSlots ?? leftInv.slots;
  const isClothingSlot =
    inventoryType === InventoryType.PLAYER && item.slot > baseSlots;

  const slotDef = isClothingSlot
    ? getSlotDefForInvSlot(item.slot, baseSlots)
    : null;

  const canDrag = useCallback(() => {
    return canPurchaseItem(item, { type: inventoryType, groups: inventoryGroups }) && canCraftItem(item, inventoryType);
  }, [item, inventoryType, inventoryGroups]);

  const [{ isDragging }, drag] = useDrag<DragSource, void, { isDragging: boolean }>(
    () => ({
      type: 'SLOT',
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
      item: () =>
        isSlotWithItem(item, inventoryType !== InventoryType.SHOP)
          ? {
              inventory: inventoryType,
              item: {
                name: item.name,
                slot: item.slot,
              },
              image: item?.name && `url(${getItemUrl(item) || 'none'}`,
            }
          : null,
      canDrag,
    }),
    [inventoryType, item]
  );

  const [{ isOver, canDrop }, drop] = useDrop<DragSource, void, { isOver: boolean; canDrop: boolean }>(
    () => ({
      accept: 'SLOT',
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
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
        // Slot & inventory yang sama tidak bisa di-drop ke diri sendiri
        if (source.item.slot === item.slot && source.inventory === inventoryType) return false;

        // Tidak bisa drop ke shop / crafting
        if (inventoryType === InventoryType.SHOP || inventoryType === InventoryType.CRAFTING) return false;

        // ── Clothing slot: validasi kecocokan item ──────────────────────────
        if (isClothingSlot) {
          if (!slotDef) return false; // slot tidak dikenali, tolak semua

          // Hanya terima dari player inventory
          if (source.inventory !== InventoryType.PLAYER) return false;

          // Jangan dari sesama clothing slot (biarkan CharacterOutfit yang handle swap antar slot)
          const sourceIsClothing = source.item.slot > baseSlots;
          if (sourceIsClothing) return false;

          // Cek item yang di-drag cocok dengan slot ini
          const sourceItem = leftInv.items[source.item.slot - 1];
          if (!isSlotWithItem(sourceItem)) return false;
          return itemMatchesClothingSlot(sourceItem, slotDef);
        }

        // ── Slot biasa: jangan terima item dari clothing slot ──────────────
        // (Clothing slot ke inventory biasa dibiarkan — user sengaja unequip)
        return true;
      },
    }),
    [inventoryType, item, isClothingSlot, slotDef, baseSlots, leftInv]
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

  const refs = useMergeRefs([connectRef, ref]);

  // Border visual beda untuk clothing slot (kosong: dashed, hover reject/accept)
  const getSlotBorder = () => {
    if (isOver && isClothingSlot) {
      return canDrop
        ? '1px dashed rgba(79,195,247,0.8)'   // accept — biru
        : '1px dashed rgba(239,83,80,0.8)';   // reject — merah
    }
    if (isOver) return '1px dashed rgba(255,255,255,0.4)';
    if (isClothingSlot && !isSlotWithItem(item)) return '1px dashed rgba(255,255,255,0.12)';
    return '';
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
        // Clothing slot kosong: sedikit lebih gelap biar keliatan beda
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
            if (timerRef.current) {
              clearTimeout(timerRef.current);
              timerRef.current = null;
            }
          }}
        >
          <div
            className={
              inventoryType === 'player' && item.slot <= 5 ? 'item-hotslot-header-wrapper' : 'item-slot-header-wrapper'
            }
          >
            {inventoryType === 'player' && item.slot <= 5 && <div className="inventory-slot-number">{item.slot}</div>}
            <div className="item-slot-info-wrapper">
              <p>
                {item.weight > 0
                  ? item.weight >= 1000
                    ? `${(item.weight / 1000).toLocaleString('en-us', {
                        minimumFractionDigits: 2,
                      })}kg `
                    : `${item.weight.toLocaleString('en-us', {
                        minimumFractionDigits: 0,
                      })}g `
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
                        <p>
                          {Locale.$ || '$'}
                          {item.price.toLocaleString('en-us')}
                        </p>
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

      {/* Icon hint untuk clothing slot kosong */}
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