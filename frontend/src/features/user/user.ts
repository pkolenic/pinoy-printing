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

export const user = createApi({
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/users',
    prepareHeaders: (headers, { getState }) => {
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
      // Refetch when any param changes by including the whole params object in the tag ID
      providesTags: (_result, _error, params) => [
        { type: "Users", id: JSON.stringify(params) }
      ],
    }),
    getUser: build.query<UserApiResponse, string>({
      query: (id) => `/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Users', id }],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetUserQuery,
} = user;
