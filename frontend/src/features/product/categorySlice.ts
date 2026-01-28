import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../../app/store.ts';
import type { Category } from "../models.ts";

export const categorySlice = createApi({
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/categories',
    prepareHeaders: (headers, { getState }) => {
      const state = getState() as RootState;
      const token = state.auth.token;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  reducerPath: 'categoryApi',
  tagTypes: ['Categories'],
  endpoints: build => ({
    getCategoryTree: build.query<Category[], void>({
      query: () => '/tree',
      providesTags: (result, _error, _id) =>
        result
          ? [{ type: 'Categories', id: 'TREE' }]
          : [{ type: 'Categories', id: 'TREE' }],
    }),
  }),
});

export const {
  useGetCategoryTreeQuery,
} = categorySlice;
