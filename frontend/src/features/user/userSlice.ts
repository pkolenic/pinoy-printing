import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { RootState } from "../../app/store.ts";
import type { User } from "../models.ts";

type UserApiResponse = User;

type UsersApiResponse = {
  data: User[];
  limit: number;
  currentPage: number;
  totalItems: number;
  totalPages: number;
  nextPageUrl: string;
  prevPageUrl: string;
}

type GetUsersParams = {
  limit?: number;
  page?: number;
  role?: "admin" | "customer" | "owner" | "staff";
  search?: string;
  phone?: string;
  sortBy?: string; // e.g., "name" or "-name"
}

export const userSlice = createApi({
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/users',
    prepareHeaders: (headers, {getState}) => {
      const state = getState() as RootState;
      const token = state.auth.token;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  reducerPath: 'usersApi',
  tagTypes: ['Users'],
  endpoints: build => ({
    getUsers: build.query<UsersApiResponse, GetUsersParams | void>({
      query: (params) => {
        // Use URLSearchParams to handle encoding and undefined values automatically
        const queryParams = new URLSearchParams();

        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              queryParams.append(key, value.toString());
            }
          });
        }

        return `?${queryParams.toString()}`;
      },
      // Provides 'LIST' to allow mass invalidation
      providesTags: (result) =>
        result
          ? [...result.data.map(({id}) => ({type: 'Users' as const, id})), {type: 'Users', id: 'LIST'}]
          : [{type: 'Users', id: 'LIST'}],
    }),
    getUser: build.query<UserApiResponse, string>({
      query: (id) => `/${id}`,
      providesTags: (_result, _error, id) => [{type: 'Users', id}],
    }),
    updateUser: build.mutation<UserApiResponse, { id: string; data: Partial<User> }>({
      query: ({id, data}) => ({
        url: `/${id}`,
        method: 'PUT',
        body: data,
      }),
      // Invalidates the specific user and the list to ensure data consistency
      invalidatesTags: (_result, _error, {id}) => [
        {type: 'Users', id},
        {type: 'Users', id: 'LIST'}
      ],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetUserQuery,
  useUpdateUserMutation,
} = userSlice;
