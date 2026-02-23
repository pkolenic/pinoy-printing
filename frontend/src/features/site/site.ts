import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { SiteConfig } from "../models.ts";

export const siteApiSlice = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: '/site' }),
  reducerPath: 'siteApi',
  refetchOnFocus: false,
  refetchOnReconnect: false,
  tagTypes: ['Site'],
  endpoints: build => ({
    getSiteConfig: build.query<SiteConfig, void>({
      query: () => {
        const searchParams = new URLSearchParams(window.location.search);
        const site = searchParams.get('SITE');
        return {
          url: '',
          params: site ? { SITE: site } : {},
        };
      },
      keepUnusedDataFor: 86400, // 24 hours
      providesTags: ['Site'],
    })
  })
});

export const {
  useGetSiteConfigQuery,
} = siteApiSlice;
