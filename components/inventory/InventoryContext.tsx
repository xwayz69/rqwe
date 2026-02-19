import { onUse } from '../../dnd/onUse';
import { onGive } from '../../dnd/onGive';
import { onDrop } from '../../dnd/onDrop';
import { Items } from '../../store/items';
import { fetchNui } from '../../utils/fetchNui';
import { Locale } from '../../store/locale';
import { isSlotWithItem } from '../../helpers';
import { setClipboard } from '../../utils/setClipboard';
import { useAppDispatch, useAppSelector } from '../../store';
import { selectLeftInventory } from '../../store/inventory';
import React from 'react';
import { Menu, MenuItem } from '../utils/menu/Menu';
import { CLOTHING_ITEM_REGISTRY, CLOTHING_SLOT_ORDER } from '../../typings/clothing';
import { SlotWithItem, InventoryType } from '../../typings';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Cek apakah item adalah clothing (dari registry atau metadata) */
const isClothingItem = (item: SlotWithItem): boolean => {
  if (item.metadata?.clothingCategory) return true;
  return item.name in CLOTHING_ITEM_REGISTRY;
};

/** Dapatkan info clothing dari item (category + componentId) */
const getClothingInfo = (item: SlotWithItem) => {
  const meta = item.metadata || {};
  if (meta.clothingCategory !== undefined) {
    return { category: meta.clothingCategory, componentId: meta.clothingComponentId };
  }
  return CLOTHING_ITEM_REGISTRY[item.name] ?? null;
};

/** Cek apakah item sudah equipped (ada di clothing slot) */
const useIsEquipped = (item: SlotWithItem | null): { equipped: boolean; clothingSlotNum: number } => {
  const leftInventory = useAppSelector(selectLeftInventory);

  if (!item || !isClothingItem(item)) return { equipped: false, clothingSlotNum: -1 };

  const baseSlots = leftInventory.baseSlots ?? leftInventory.slots;
  const info = getClothingInfo(item);
  if (!info) return { equipped: false, clothingSlotNum: -1 };

  const idx = CLOTHING_SLOT_ORDER.findIndex(
    (s) => s.category === info.category && s.id === info.componentId
  );
  if (idx === -1) return { equipped: false, clothingSlotNum: -1 };

  const clothingSlotNum = baseSlots + idx + 1;
  const clothingItem = leftInventory.items[clothingSlotNum - 1];

  // Equipped jika clothing slot berisi item dengan nama yang sama
  const equipped = !!(
    clothingItem &&
    'name' in clothingItem &&
    (clothingItem as SlotWithItem).name === item.name
  );

  return { equipped, clothingSlotNum };
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface DataProps {
  action: string;
  component?: string;
  slot?: number;
  serial?: string;
  id?: number;
}

interface Button {
  label: string;
  index: number;
  group?: string;
}
interface ButtonWithIndex extends Button { index: number; }
interface Group { groupName: string | null; buttons: ButtonWithIndex[]; }

// ─── Component ────────────────────────────────────────────────────────────────
const InventoryContext: React.FC = () => {
  const dispatch     = useAppDispatch();
  const contextMenu  = useAppSelector((state) => state.contextMenu);
  const leftInventory = useAppSelector(selectLeftInventory);
  const item         = contextMenu.item;

  const { equipped, clothingSlotNum } = useIsEquipped(item);
  const isClothing = item ? isClothingItem(item) : false;

  // ─── Action handler ──────────────────────────────────────────────────────
  const handleClick = (data: DataProps) => {
    if (!item) return;

    switch (data.action) {
      case 'use':
        onUse({ name: item.name, slot: item.slot });
        break;

      case 'equip': {
        // Pindahkan item ke clothing slot yang sesuai
        const info = getClothingInfo(item);
        if (!info || clothingSlotNum <= 0) break;

        onDrop(
          { inventory: InventoryType.PLAYER, item: { name: item.name, slot: item.slot } },
          { inventory: InventoryType.PLAYER, item: { slot: clothingSlotNum } }
        );
        fetchNui('equipClothing', {
          slot:        clothingSlotNum,
          fromSlot:    item.slot,
          itemName:    item.name,
          category:    info.category,
          componentId: info.componentId,
          drawable:    item.metadata?.drawable  ?? 0,
          texture:     item.metadata?.texture   ?? 0,
          palette:     item.metadata?.palette   ?? 0,
        });
        break;
      }

      case 'unequip': {
        // Pindahkan dari clothing slot ke slot inventory kosong
        const info = getClothingInfo(item);
        if (!info || clothingSlotNum <= 0) break;

        const baseSlots = leftInventory.baseSlots ?? leftInventory.slots;
        const emptySlot = leftInventory.items
          .slice(0, baseSlots)
          .find((s) => !isSlotWithItem(s));

        if (!emptySlot) {
          // Inventory penuh — tidak bisa unequip
          break;
        }

        onDrop(
          { inventory: InventoryType.PLAYER, item: { name: item.name, slot: clothingSlotNum } },
          { inventory: InventoryType.PLAYER, item: { slot: emptySlot.slot } }
        );
        fetchNui('unequipClothing', {
          slot:        clothingSlotNum,
          category:    info.category,
          componentId: info.componentId,
        });
        break;
      }

      case 'give':
        onGive({ name: item.name, slot: item.slot });
        break;

      case 'drop':
        isSlotWithItem(item) && onDrop({ item, inventory: 'player' });
        break;

      case 'remove':
        fetchNui('removeComponent', { component: data.component, slot: data.slot });
        break;

      case 'removeAmmo':
        fetchNui('removeAmmo', item.slot);
        break;

      case 'copy':
        setClipboard(data.serial || '');
        break;

      case 'custom':
        fetchNui('useButton', { id: (data.id || 0) + 1, slot: item.slot });
        break;
    }
  };

  const groupButtons = (buttons: any[]): Group[] =>
    buttons.reduce((groups: Group[], button: Button, index: number) => {
      if (button.group) {
        const gi = groups.findIndex((g) => g.groupName === button.group);
        if (gi !== -1) groups[gi].buttons.push({ ...button, index });
        else groups.push({ groupName: button.group, buttons: [{ ...button, index }] });
      } else {
        groups.push({ groupName: null, buttons: [{ ...button, index }] });
      }
      return groups;
    }, []);

  return (
    <>
      <Menu>
        {/* ── Clothing item: Equip / Unequip ─────────────────────────────── */}
        {isClothing ? (
          equipped ? (
            <MenuItem
              onClick={() => handleClick({ action: 'unequip' })}
              label="Unequip"
              className="context-menu-item-unequip"
            />
          ) : (
            <MenuItem
              onClick={() => handleClick({ action: 'equip' })}
              label="Equip"
              className="context-menu-item-equip"
            />
          )
        ) : (
          /* ── Non-clothing: Use normal ──────────────────────────────────── */
          <MenuItem
            onClick={() => handleClick({ action: 'use' })}
            label={Locale.ui_use || 'Use'}
          />
        )}

        <MenuItem onClick={() => handleClick({ action: 'give' })} label={Locale.ui_give || 'Give'} />
        <MenuItem onClick={() => handleClick({ action: 'drop' })} label={Locale.ui_drop || 'Drop'} />

        {item?.metadata?.ammo > 0 && (
          <MenuItem onClick={() => handleClick({ action: 'removeAmmo' })} label={Locale.ui_remove_ammo || 'Remove Ammo'} />
        )}
        {item?.metadata?.serial && (
          <MenuItem
            onClick={() => handleClick({ action: 'copy', serial: item?.metadata?.serial })}
            label={Locale.ui_copy || 'Copy Serial'}
          />
        )}
        {(item?.metadata?.components?.length ?? 0) > 0 && (
          <Menu label={Locale.ui_removeattachments || 'Remove Attachments'}>
            {(item?.metadata?.components ?? []).map((component: string, index: number) => (
              <MenuItem
                key={index}
                onClick={() => handleClick({ action: 'remove', component, slot: item?.slot })}
                label={Items[component]?.label || component}
              />
            ))}
          </Menu>
        )}
        {((item?.name && Items[item.name]?.buttons?.length) || 0) > 0 &&
          item?.name &&
          groupButtons(Items[item.name]!.buttons!).map((group, index) => (
            <React.Fragment key={index}>
              {group.groupName ? (
                <Menu label={group.groupName}>
                  {group.buttons.map((button) => (
                    <MenuItem
                      key={button.index}
                      onClick={() => handleClick({ action: 'custom', id: button.index })}
                      label={button.label}
                    />
                  ))}
                </Menu>
              ) : (
                group.buttons.map((button) => (
                  <MenuItem
                    key={button.index}
                    onClick={() => handleClick({ action: 'custom', id: button.index })}
                    label={button.label}
                  />
                ))
              )}
            </React.Fragment>
          ))}
      </Menu>
    </>
  );
};

export default InventoryContext;