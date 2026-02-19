import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Inventory } from '../../typings';
import WeightBar from '../utils/WeightBar';
import InventorySlot from './InventorySlot';
import { getTotalWeight } from '../../helpers';
import { useAppSelector } from '../../store';
import { useIntersection } from '../../hooks/useIntersection';

const PAGE_SIZE = 30;

const CLOTHING_SLOT_INFO: Record<number, { icon: string; label: string }> = {
  0:  { icon: '🧢', label: 'Head' },
  1:  { icon: '🎭', label: 'Mask' },
  2:  { icon: '💈', label: 'Hair' },
  3:  { icon: '👕', label: 'Torso' },
  4:  { icon: '👖', label: 'Legs' },
  5:  { icon: '🎒', label: 'Bag' },
  6:  { icon: '👟', label: 'Shoes' },
  7:  { icon: '🧣', label: 'Access.' },
  8:  { icon: '👔', label: 'Undershirt' },
  9:  { icon: '🦺', label: 'Armor' },
  10: { icon: '🏷️', label: 'Decal' },
  11: { icon: '🧥', label: 'Top' },
  12: { icon: '🎩', label: 'Hat' },
  13: { icon: '🕶️', label: 'Glasses' },
  14: { icon: '🎧', label: 'Ears' },
  15: { icon: '⌚', label: 'Watch' },
  16: { icon: '📿', label: 'Bracelet' },
};

const InventoryGrid: React.FC<{ inventory: Inventory }> = ({ inventory }) => {
  const [page, setPage] = useState(0);
  const containerRef = useRef(null);
  const { ref, entry } = useIntersection({ threshold: 0.5 });
  const isBusy = useAppSelector((state) => state.inventory.isBusy);

  useEffect(() => {
    if (entry && entry.isIntersecting) {
      setPage((prev) => ++prev);
    }
  }, [entry]);

  const isPlayer = inventory.type === 'player';
  const baseSlots = inventory.baseSlots ?? inventory.slots;
  const displayItems = inventory.items.slice(0, baseSlots);
  const clothingItems = isPlayer ? inventory.items.slice(baseSlots) : [];

  const weight = useMemo(
    () =>
      inventory.maxWeight !== undefined
        ? Math.floor(getTotalWeight(displayItems) * 1000) / 1000
        : 0,
    [inventory.maxWeight, displayItems]
  );

  return (
    <div className="inventory-grid-wrapper" style={{ pointerEvents: isBusy ? 'none' : 'auto' }}>
      <div>
        <div className="inventory-grid-header-wrapper">
          <p>{inventory.label}</p>
          {inventory.maxWeight && (
            <p>{weight / 1000}/{inventory.maxWeight / 1000}kg</p>
          )}
        </div>
        <WeightBar percent={inventory.maxWeight ? (weight / inventory.maxWeight) * 100 : 0} />
      </div>

      {/* Single grid — normal slots + clothing slots langsung nyambung */}
      <div className="inventory-grid-container" ref={containerRef}>
        {/* Slot biasa */}
        {displayItems.slice(0, (page + 1) * PAGE_SIZE).map((item, index) => (
          <InventorySlot
            key={`${inventory.type}-${inventory.id}-${item.slot}`}
            item={item}
            ref={index === (page + 1) * PAGE_SIZE - 1 ? ref : null}
            inventoryType={inventory.type}
            inventoryGroups={inventory.groups}
            inventoryId={inventory.id}
          />
        ))}

        {/* Clothing slots — langsung lanjut di grid yang sama */}
        {clothingItems.map((item, index) => {
          const info = CLOTHING_SLOT_INFO[index] ?? { icon: '👒', label: `C${index}` };
          return (
            <InventorySlot
              key={`${inventory.type}-${inventory.id}-clothing-${item.slot}`}
              item={item}
              ref={null}
              inventoryType={inventory.type}
              inventoryGroups={inventory.groups}
              inventoryId={inventory.id}
              clothingSlotInfo={info}
            />
          );
        })}
      </div>
    </div>
  );
};

export default InventoryGrid;