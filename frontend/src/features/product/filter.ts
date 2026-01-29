import { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from "../../app/createAppSlice.ts";
import { Category } from "../models.ts";

interface FilterState {
  selectedCategory: Category;
}

const initialState: FilterState = {
  selectedCategory: {
    id: 'all-gifts',
    slug: 'all-gifts',
    name: 'All Gifts',
    path: '/',
  },
};

export const filterSlice = createAppSlice({
  name: 'filter',
  initialState,
  reducers: {
    setSelectedCategory: (state, action: PayloadAction<Category>) => {
      state.selectedCategory = action.payload;
    },
  }
});

export const { setSelectedCategory } = filterSlice.actions;
