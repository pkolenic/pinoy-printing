import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { RootState } from "../../app/store.ts";
import type {
  Address,
  User,
} from "../models.ts";

type PasswordData = {
  password: string,
}
type MessageResponse = {
  message: string;
}

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
    getUser: build.query<User, string>({
      query: (id) => `/${id}`,
      providesTags: (_result, _error, id) => [{type: 'Users', id}],
    }),
    updateUser: build.mutation<User, { id: string; data: Partial<User> }>({
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
    createAddress: build.mutation<Address, { id: string; data: Partial<Address>}>({
      query: ({id, data}) => ({
        url: `/${id}/address`,
        method: 'POST',
        body: data,
      }),
      // Invalidates the specific user so their profile/address list updates
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Users', id }
      ],
    }),
    updateAddress: build.mutation<Address, { id: string; addressId: string; data: Partial<Address>}>({
      query: ({id, addressId, data}) => ({
        url: `/${id}/address/${addressId}`,
        method: 'PUT',
        body: data,
      }),
      // Invalidates the specific user so their profile/address list updates
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Users', id }
      ],
    }),
    deleteAddress: build.mutation<void, { id: string; addressId: string}>({
      query: ({id, addressId}) => ({
        url: `/${id}/address/${addressId}`,
        method: 'DELETE',
      }),
      // Invalidates the specific user so their profile/address list updates
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Users', id }
      ],
    }),
    updatePassword: build.mutation<MessageResponse, { id: string; data: Partial<PasswordData>}>({
      query: ({id, data}) => ({
        url: `/${id}/password`,
        method: 'PUT',
        body: data,
      }),
      // Nothing to Invalidate as only the user's password is changing
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetUserQuery,
  useUpdateUserMutation,
  useCreateAddressMutation,
  useUpdateAddressMutation,
  useDeleteAddressMutation,
  useUpdatePasswordMutation,
} = userSlice;
