import React, { useState } from 'react';
import useNuiEvent from '../../hooks/useNuiEvent';
import InventoryHotbar from './InventoryHotbar';
import { useAppDispatch } from '../../store';
import { refreshSlots, setAdditionalMetadata, setupInventory, setItemAmount, selectItemAmount, setBaseSlots } from '../../store/inventory';
import { useExitListener } from '../../hooks/useExitListener';
import type { Inventory as InventoryProps } from '../../typings';
import RightInventory from './RightInventory';
import LeftInventory from './LeftInventory';
import Tooltip from '../utils/Tooltip';
import { closeTooltip } from '../../store/tooltip';
import InventoryContext from './InventoryContext';
import { closeContextMenu } from '../../store/contextMenu';
import Fade from '../utils/transitions/Fade';
import CharacterOutfit from './CharacterOutfit';
import { setClothingState } from '../../store/clothing';
import { ClothingState } from '../../typings/clothing';
import { fetchNui } from '../../utils/fetchNui';
import { Locale } from '../../store/locale';
import { useAppSelector } from '../../store';
import { onUse } from '../../dnd/onUse';
import { onGive } from '../../dnd/onGive';
import { useDragLayer, useDrop } from 'react-dnd';
import { DragSource } from '../../typings';

// ─── Bottom Controls ──────────────────────────────────────────────────────────
const BottomControls: React.FC = () => {
  const itemAmount = useAppSelector(selectItemAmount);
  const dispatch   = useAppDispatch();

  const [, use] = useDrop<DragSource, void, any>(() => ({
    accept: 'SLOT',
    drop: (source) => { source.inventory === 'player' && onUse(source.item); },
  }));
  const [, give] = useDrop<DragSource, void, any>(() => ({
    accept: 'SLOT',
    drop: (source) => { source.inventory === 'player' && onGive(source.item); },
  }));

  return (
    <div className="inv-controls">
      <button className="inv-ctrl-btn" onClick={() => dispatch(setItemAmount(Math.max(0, itemAmount - 1)))}>−</button>
      <input
        className="inv-ctrl-amount"
        type="number"
        value={itemAmount}
        min={0}
        onChange={(e) => {
          const v = Math.max(0, Math.floor(isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber));
          dispatch(setItemAmount(v));
        }}
      />
      <button className="inv-ctrl-btn" onClick={() => dispatch(setItemAmount(itemAmount + 1))}>+</button>
      <button className="inv-ctrl-action-btn" ref={use}>{Locale.ui_use || 'USE'}</button>
      <button className="inv-ctrl-action-btn" ref={give}>{Locale.ui_give || 'GIVE'}</button>
      <button className="inv-ctrl-action-btn inv-ctrl-info" onClick={() => fetchNui('exit')}>
        {Locale.ui_close || 'CLOSE'}
      </button>
    </div>
  );
};

// ─── Inventory Root ───────────────────────────────────────────────────────────
const InventoryRoot: React.FC = () => {
  const dispatch   = useAppDispatch();
  const isDragging = useDragLayer((monitor) => monitor.isDragging());

  useNuiEvent<boolean>('setInventoryVisible', () => {});
  useNuiEvent('refreshSlots', (data) => dispatch(refreshSlots(data)));
  useNuiEvent('displayMetadata', (data: Array<{ metadata: string; value: string }>) => {
    dispatch(setAdditionalMetadata(data));
  });
  useNuiEvent<ClothingState>('syncClothing', (data) => {
    dispatch(setClothingState(data));
  });
  // Terima baseSlots dari server via cl_clothing.lua
  useNuiEvent<number>('setBaseSlots', (slots) => {
    dispatch(setBaseSlots(slots));
  });

  return (
    <div className={`inv-root${isDragging ? ' dragging' : ''}`}>
      <div className="inv-columns">
        <div className="inv-col"><LeftInventory /></div>
        <div className="inv-col"><CharacterOutfit /></div>
        <div className="inv-col"><RightInventory /></div>
      </div>
      <BottomControls />
      <Tooltip />
      <InventoryContext />
    </div>
  );
};

// ─── Main Inventory ───────────────────────────────────────────────────────────
const Inventory: React.FC = () => {
  const [inventoryVisible, setInventoryVisible] = useState(false);
  const dispatch = useAppDispatch();

  useNuiEvent<boolean>('setInventoryVisible', setInventoryVisible);
  useNuiEvent<false>('closeInventory', () => {
    setInventoryVisible(false);
    dispatch(closeContextMenu());
    dispatch(closeTooltip());
  });
  useExitListener(setInventoryVisible);

  useNuiEvent<{ leftInventory?: InventoryProps; rightInventory?: InventoryProps }>(
    'setupInventory', (data) => {
      dispatch(setupInventory(data));
      !inventoryVisible && setInventoryVisible(true);
    }
  );

  return (
    <>
      <Fade in={inventoryVisible}>
        <span><InventoryRoot /></span>
      </Fade>
      <InventoryHotbar />
    </>
  );
};

export default Inventory;