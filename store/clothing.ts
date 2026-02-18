import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ClothingState } from '../typings/clothing';

// Store ini minimal — hanya menyimpan state untuk syncToNUI dari server
// State visual sebenarnya dibaca dari leftInventory.items[slot 51-67]
const initialState: ClothingState = {};

export const clothingSlice = createSlice({
  name: 'clothing',
  initialState,
  reducers: {
    setClothingState(_state, action: PayloadAction<ClothingState>) {
      return action.payload;
    },
  },
});

export const { setClothingState } = clothingSlice.actions;
export const selectClothingState = (state: { clothing: ClothingState }) => state.clothing;
export default clothingSlice.reducer;