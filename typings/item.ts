export type ItemData = {
  name: string;
  label: string;
  stack: boolean;
  usable: boolean;
  close: boolean;
  count: number;
  description?: string;
  buttons?: string[];
  ammoName?: string;
  image?: string;
  // Clothing system — dibaca dari item definition (dikirim via getItemData/init)
  clothingCategory?:'clothes' | 'props';
  clothingComponentId?: number;
};