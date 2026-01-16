/* eslint-disable no-restricted-imports */
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "../app/store.ts"

import { useAuthSession } from "./useAuthSession.ts";

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
export {
  useAuthSession,
}
