import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { server } from "../../constants";
const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: `${server}/api/v1/`,
    prepareHeaders: (headers) => {
      headers.set("Content-Type", "application/json");
      return headers;
    },
  }),
  tagTypes: [],
  endpoints: (builder) => ({
    logout: builder.mutation({
      query: () => ({
        url: "user/logout",
        method: "post",
        credentials: "include",
      }),
    }),
    refreshToken: builder.mutation({
      query: () => ({
        url: "user/refresh-token",
        method: "post",
        credentials: "include",
      }),
    }),
    processDataset: builder.mutation({
      query: ({ file, level }) => {
        const formData = new FormData();

        formData.append("file", file); // actual file
        formData.append("level", level); // masking level
     
        return {
          url: "pipeline/process",
          method: "POST",
          body: formData,
          credentials: "include",
        };
      },
    }),

    getDashboardData: builder.query({
        query: ()=>({
          url:"pipeline/dashboard",
          credentials:"include",
        })
    })
  }),
});

export default api;

export const {
  useLogoutMutation,
  useRefreshTokenMutation,
  useProcessDatasetMutation,
  useGetDashboardDataQuery,
} = api;
