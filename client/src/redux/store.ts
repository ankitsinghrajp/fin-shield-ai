import { configureStore } from '@reduxjs/toolkit'
import { persistStore, persistReducer } from 'redux-persist'
import storage from 'redux-persist/lib/storage'
import { combineReducers } from '@reduxjs/toolkit'
import authSlice from './reducers/auth'
import api from './api/api'

// Persist configuration
const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth'] // Only persist auth reducer
}

// Combine reducers
const rootReducer = combineReducers({
  [authSlice.name]: authSlice.reducer,
  [api.reducerPath]: api.reducer,
})

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer)

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }).concat(api.middleware)
})

export const persistor = persistStore(store)

// Types for TypeScript
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch