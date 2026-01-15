import { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from "../../app/createAppSlice.ts";

interface AuthState {
  token: string | null;
}

const initialState: AuthState = {
  token: null,
};

export const authSlice = createAppSlice({
  name: 'auth',
  initialState,
  reducers: {
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
    },
    clearToken: (state) => {
      state.token = null;
    }
  },
});

export const { setToken, clearToken } = authSlice.actions;
