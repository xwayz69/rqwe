import React, { useCallback } from 'react';
import { useDrag, useDrop, useDragDropManager } from 'react-dnd';
import { useAppDispatch, useAppSelector } from '../../store';
import { DragSource, InventoryType, SlotWithItem } from '../../typings';
import { selectLeftInventory } from '../../store/inventory';
import { getItemUrl, isSlotWithItem } from '../../helpers';
import { closeTooltip, openTooltip } from '../../store/tooltip';
import { onDrop } from '../../dnd/onDrop';
import { fetchNui } from '../../utils/fetchNui';
import { CLOTHING_ITEM_REGISTRY, CLOTHES_SLOTS, PROPS_SLOTS, ClothingSlotDef } from '../../typings/clothing';
import { Items } from '../../store/items';

// Urutan clothing slot — harus sama dengan sv_clothing.lua CLOTHING_SLOT_ORDER
const CLOTHING_SLOT_ORDER: Array<{ category: string; id: number }> = [
  { category: 'clothes', id: 0  }, // Head
  { category: 'clothes', id: 1  }, // Masks
  { category: 'clothes', id: 2  }, // Hair
  { category: 'clothes', id: 3  }, // Torsos
  { category: 'clothes', id: 4  }, // Legs
  { category: 'clothes', id: 5  }, // Bags
  { category: 'clothes', id: 6  }, // Shoes
  { category: 'clothes', id: 7  }, // Accessories
  { category: 'clothes', id: 8  }, // Undershirts
  { category: 'clothes', id: 9  }, // Body Armors
  { category: 'clothes', id: 10 }, // Decals
  { category: 'clothes', id: 11 }, // Tops
  { category: 'props',   id: 0  }, // Hats
  { category: 'props',   id: 1  }, // Glasses
  { category: 'props',   id: 2  }, // Ears
  { category: 'props',   id: 6  }, // Watches
  { category: 'props',   id: 7  }, // Bracelets
];

const getInvSlotNum = (baseSlots: number, category: string, id: number): number => {
  const idx = CLOTHING_SLOT_ORDER.findIndex(s => s.category === category && s.id === id);
  return idx === -1 ? -1 : baseSlots + idx + 1;
};

const getSlotKey = (s: ClothingSlotDef) => `${s.category}_${s.id}`;

const itemMatchesSlot = (item: SlotWithItem, slotDef: ClothingSlotDef): boolean => {
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

// ─── Single Clothing Slot ────────────────────────────────────────────────────
const ClothingSlot: React.FC<{ slotDef: ClothingSlotDef }> = ({ slotDef }) => {
  const dispatch      = useAppDispatch();
  const manager       = useDragDropManager();
  const leftInventory = useAppSelector(selectLeftInventory);
  const timerRef      = React.useRef<number | null>(null);

  const baseSlots  = leftInventory.baseSlots ?? leftInventory.slots;
  const invSlotNum = getInvSlotNum(baseSlots, slotDef.category, slotDef.id);
  const currentItem = invSlotNum > 0 ? leftInventory.items[invSlotNum - 1] : undefined;
  const hasItem     = currentItem != null && isSlotWithItem(currentItem);

  // ── DRAG (dari clothing slot balik ke inventory) ──────────────────────────
  const canDragOut = useCallback(() => hasItem, [hasItem]);

  const [{ isDragging }, drag] = useDrag<DragSource, void, { isDragging: boolean }>(
    () => ({
      type: 'SLOT',
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
      item: () =>
        hasItem && currentItem
          ? {
              inventory: InventoryType.PLAYER,
              item: { name: (currentItem as SlotWithItem).name, slot: invSlotNum },
              image: `url(${getItemUrl(currentItem as SlotWithItem) || 'none'})`,
            }
          : null,
      canDrag: canDragOut,
      end: (_item, monitor) => {
        // Kalau drop berhasil ke slot inventory biasa, trigger unequip di server
        if (monitor.didDrop() && hasItem && currentItem) {
          fetchNui('unequipClothing', {
            slot:        invSlotNum,
            category:    slotDef.category,
            componentId: slotDef.id,
          });
        }
      },
    }),
    [hasItem, currentItem, invSlotNum, slotDef]
  );

  // ── DROP (dari inventory ke clothing slot) ────────────────────────────────
  const [{ isOver, canDrop }, drop] = useDrop<DragSource, void, { isOver: boolean; canDrop: boolean }>(
    () => ({
      accept: 'SLOT',
      collect: (m) => ({ isOver: m.isOver(), canDrop: m.canDrop() }),

      canDrop: (source) => {
        // Hanya dari player inventory, bukan dari clothing slot lain
        if (source.inventory !== InventoryType.PLAYER) return false;
        if (invSlotNum <= 0) return false;
        if (source.item.slot === invSlotNum) return false;
        if (source.item.slot > baseSlots) return false; // jangan dari sesama clothing slot

        const sourceItem = leftInventory.items[source.item.slot - 1];
        if (!isSlotWithItem(sourceItem)) return false;
        return itemMatchesSlot(sourceItem, slotDef);
      },

      drop: (source) => {
        dispatch(closeTooltip());
        if (invSlotNum <= 0) return;

        // Pindahkan item ke clothing slot via onDrop (swap/move di redux)
        onDrop(source, {
          inventory: InventoryType.PLAYER,
          item: { slot: invSlotNum },
        });

        // Trigger server untuk apply visual ke ped
        const sourceItem = leftInventory.items[source.item.slot - 1] as SlotWithItem;
        fetchNui('equipClothing', {
          slot:        invSlotNum,
          fromSlot:    source.item.slot,
          itemName:    sourceItem?.name,
          category:    slotDef.category,
          componentId: slotDef.id,
          drawable:    sourceItem?.metadata?.drawable  ?? 0,
          texture:     sourceItem?.metadata?.texture   ?? 0,
          palette:     sourceItem?.metadata?.palette   ?? 0,
        });
      },
    }),
    [slotDef, leftInventory, invSlotNum, baseSlots]
  );

  // Gabungkan drag + drop ref
  const connectRef = (el: HTMLDivElement | null) => {
    drag(el);
    drop(el);
  };

  // ── Unequip via tombol ✕ ──────────────────────────────────────────────────
  const handleUnequip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasItem || !currentItem) return;
    dispatch(closeTooltip());

    // Cari slot kosong pertama di inventory biasa
    const emptySlot = leftInventory.items
      .slice(0, baseSlots)
      .find((s) => !isSlotWithItem(s));

    if (!emptySlot) return; // inventory penuh

    onDrop(
      { inventory: InventoryType.PLAYER, item: { name: (currentItem as SlotWithItem).name, slot: invSlotNum } },
      { inventory: InventoryType.PLAYER, item: { slot: emptySlot.slot } }
    );

    fetchNui('unequipClothing', {
      slot:        invSlotNum,
      category:    slotDef.category,
      componentId: slotDef.id,
    });
  };

  const bgImage = hasItem ? `url(${getItemUrl(currentItem as SlotWithItem)})` : undefined;

  return (
    <div
      ref={connectRef}
      className={[
        'cslot',
        hasItem            ? 'cslot-equipped' : '',
        isDragging         ? 'cslot-dragging' : '',
        isOver && canDrop  ? 'cslot-accept'   : '',
        isOver && !canDrop ? 'cslot-reject'   : '',
      ].join(' ')}
      style={{
        backgroundImage: bgImage,
        opacity: isDragging ? 0.4 : 1,
        cursor: hasItem ? 'grab' : 'default',
      }}
      onMouseEnter={() => {
        if (hasItem && currentItem) {
          timerRef.current = window.setTimeout(() => {
            dispatch(openTooltip({ item: currentItem as SlotWithItem, inventoryType: 'player' }));
          }, 500);
        }
      }}
      onMouseLeave={() => {
        dispatch(closeTooltip());
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      }}
      title={slotDef.part}
    >
      {!hasItem && (
        <>
          <span className="cslot-icon">{slotDef.icon}</span>
          <span className="cslot-label">{slotDef.part}</span>
        </>
      )}

      {hasItem && currentItem && (
        <>
          {/* Tombol unequip ✕ */}
          <button className="cslot-unequip" onClick={handleUnequip} title="Unequip">
            ✕
          </button>

          <span className="cslot-icon-sm">{slotDef.icon}</span>

          <div className="inventory-slot-label-box" style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <div className="inventory-slot-label-text">
              {(currentItem as SlotWithItem).metadata?.label
                || Items[(currentItem as SlotWithItem).name]?.label
                || (currentItem as SlotWithItem).name}
            </div>
          </div>
        </>
      )}

      {isOver && (
        <div className="cslot-hint">{canDrop ? '▼' : '✗'}</div>
      )}
    </div>
  );
};

// ─── Layout ──────────────────────────────────────────────────────────────────
const LEFT_SLOTS  = CLOTHES_SLOTS.slice(0, 6);
const RIGHT_SLOTS = CLOTHES_SLOTS.slice(6, 12);

const CharacterOutfit: React.FC = () => (
  <div className="outfit-panel">
    <div className="outfit-topbar">
      <span className="outfit-title">👤 OUTFIT</span>
    </div>
    <div className="outfit-body">
      <div className="outfit-col">
        {LEFT_SLOTS.map((s) => <ClothingSlot key={getSlotKey(s)} slotDef={s} />)}
      </div>

      <div className="outfit-character">
        <div className="outfit-char-frame">
          <svg viewBox="0 0 100 200" xmlns="http://www.w3.org/2000/svg" className="outfit-char-svg">
            <circle cx="50" cy="22" r="14" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" strokeWidth="1"/>
            <rect x="45" y="34" width="10" height="8" rx="2" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
            <path d="M28 42 L72 42 L76 100 L24 100 Z" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
            <path d="M28 44 L14 50 L12 92 L22 92 L24 52 Z" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
            <path d="M72 44 L86 50 L88 92 L78 92 L76 52 Z" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
            <path d="M28 98 L24 180 L38 180 L42 110 L50 110 L46 98 Z" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
            <path d="M72 98 L76 180 L62 180 L58 110 L50 110 L54 98 Z" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
            <ellipse cx="31" cy="182" rx="10" ry="5" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
            <ellipse cx="69" cy="182" rx="10" ry="5" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
          </svg>
        </div>
        <div className="outfit-props-row">
          {PROPS_SLOTS.map((s) => <ClothingSlot key={getSlotKey(s)} slotDef={s} />)}
        </div>
      </div>

      <div className="outfit-col">
        {RIGHT_SLOTS.map((s) => <ClothingSlot key={getSlotKey(s)} slotDef={s} />)}
      </div>
    </div>
  </div>
);

export default CharacterOutfit;