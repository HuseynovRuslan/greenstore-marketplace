import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './styles/index.css'
import { AppStoreProvider } from './app/store'
import { router } from './app/routes'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppStoreProvider>
      <RouterProvider router={router} />
    </AppStoreProvider>
  </StrictMode>,
)
