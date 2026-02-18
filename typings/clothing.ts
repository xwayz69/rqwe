// Clothing System Types
export type ClothingCategory = 'clothes' | 'props';


export interface ClothingSlotDef {
  id: number;
  part: string;
  category: ClothingCategory;
  icon?: string;
}

export interface EquippedClothingItem {
  slotDef: ClothingSlotDef;
  itemName?: string;
  itemLabel?: string;
  itemImage?: string;
  itemSlot?: number;
  drawable?: number;
  texture?: number;
  palette?: number;
}

export type ClothingState = {
  [key: string]: EquippedClothingItem | null;
};

export const CLOTHES_SLOTS: ClothingSlotDef[] = [
  { id: 0,  part: 'Head',              category: 'clothes', icon: '🧢' },
  { id: 1,  part: 'Masks',             category: 'clothes', icon: '🎭' },
  { id: 2,  part: 'Hair Styles',       category: 'clothes', icon: '💈' },
  { id: 3,  part: 'Torsos',            category: 'clothes', icon: '👕' },
  { id: 4,  part: 'Legs',              category: 'clothes', icon: '👖' },
  { id: 5,  part: 'Bags & Parachutes', category: 'clothes', icon: '🎒' },
  { id: 6,  part: 'Shoes',             category: 'clothes', icon: '👟' },
  { id: 7,  part: 'Accessories',       category: 'clothes', icon: '🧣' },
  { id: 8,  part: 'Undershirts',       category: 'clothes', icon: '👔' },
  { id: 9,  part: 'Body Armors',       category: 'clothes', icon: '🦺' },
  { id: 10, part: 'Decals',            category: 'clothes', icon: '🏷️' },
  { id: 11, part: 'Tops',              category: 'clothes', icon: '🧥' },
];

export const PROPS_SLOTS: ClothingSlotDef[] = [
  { id: 0, part: 'Hats',      category: 'props', icon: '🎩' },
  { id: 1, part: 'Glasses',   category: 'props', icon: '🕶️' },
  { id: 2, part: 'Ears',      category: 'props', icon: '🎧' },
  { id: 6, part: 'Watches',   category: 'props', icon: '⌚' },
  { id: 7, part: 'Bracelets', category: 'props', icon: '📿' },
];

export const getSlotKey = (slot: ClothingSlotDef) => `${slot.category}_${slot.id}`;

// ─── Clothing Item Registry ───────────────────────────────────────────────────
// Daftarkan semua item clothing di sini.
// Format: 'item_name': { category, componentId }
//
// CLOTHES component IDs:
//   0=Head  1=Masks  2=Hair  3=Torsos  4=Legs  5=Bags
//   6=Shoes  7=Accessories  8=Undershirts  9=Armor  10=Decals  11=Tops
//
// PROPS IDs:
//   0=Hats  1=Glasses  2=Ears  6=Watches  7=Bracelets

export type ClothingItemInfo = {
  category: ClothingCategory;
  componentId: number;
};

export const CLOTHING_ITEM_REGISTRY: Record<string, ClothingItemInfo> = {
  clothing_head:        { category: 'clothes',        componentId: 0 },
  clothing_masks:       { category: 'clothes',       componentId: 1 },
  clothing_hairstyles:  { category: 'clothes',  componentId: 2 },
  clothing_torsos:      { category: 'clothes',      componentId: 3 },
  clothing_legs:        { category: 'clothes',        componentId: 4 },
  clothing_bags:        { category: 'clothes',        componentId: 5 },
  clothing_shoes:       { category: 'clothes',       componentId: 6 },
  clothing_accessories: { category: 'clothes', componentId: 7 },
  clothing_undershirts: { category: 'clothes', componentId: 8 },
  clothing_armors:      { category: 'clothes',      componentId: 9 },
  clothing_decals:      { category: 'clothes',      componentId: 10 },
  clothing_tops:        { category: 'clothes',        componentId: 11 },

  clothing_hats:        { category: 'props',        componentId: 0 },
  clothing_glasses:     { category: 'props',     componentId: 1 },
  clothing_ears:        { category: 'props',        componentId: 2 },
  clothing_watches:     { category: 'props',     componentId: 6 },
  clothing_bracelets:   { category: 'props',   componentId: 7 },
};