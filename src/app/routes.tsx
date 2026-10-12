import type { ComponentType } from 'react'
import { createBrowserRouter } from 'react-router'
import { AdminLayout, AuthLayout, HomeLayout, MainLayout, WorkflowLayout } from '@/layouts/Layouts'
import HomePage from '@/pages/HomePage'

/** Route-level code splitting: every page except the home page is loaded on demand. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default })

/**
 * Route map (Azerbaijani, ASCII-only slugs):
 *  /                         Ana səhifə
 *  /elanlar                  Məhsul axtarışı (catalog + filters, query-string driven)
 *  /elanlar/:slug            Elan səhifəsi ("Zeytun ağacı")
 *  /saticilar/:slug          Satıcı profili ("Abşeron Tingçilik")
 *  /xidmetler                Xidmətlər
 *  /xidmetler/:slug          Xidmət səhifəsi ("Landşaft dizaynı")
 *  /daxil-ol, /qeydiyyat     Auth
 *  /kabinet, /kabinet/profil Şəxsi kabinet, Profil məlumatları
 *  /secilmisler              Seçilmişlər
 *  /elan-yerlesdir[/:step]   6-step wizard, /elan-yerlesdir/gonderildi confirmation
 *  /idareetme/*              Moderation tools
 */
export const router = createBrowserRouter([
  {
    element: <HomeLayout />,
    children: [{ index: true, element: <HomePage /> }],
  },
  {
    element: <MainLayout />,
    children: [
      { path: 'elanlar', lazy: page(() => import('@/pages/SearchPage')) },
      { path: 'elanlar/:slug', lazy: page(() => import('@/pages/ListingDetailPage')) },
      { path: 'saticilar/:slug', lazy: page(() => import('@/pages/SellerPage')) },
      { path: 'xidmetler', lazy: page(() => import('@/pages/ServicesPage')) },
      { path: 'xidmetler/:slug', lazy: page(() => import('@/pages/ServiceDetailPage')) },
      { path: 'kabinet', lazy: page(() => import('@/pages/account/DashboardPage')) },
      { path: 'kabinet/profil', lazy: page(() => import('@/pages/account/ProfilePage')) },
      { path: 'secilmisler', lazy: page(() => import('@/pages/account/FavoritesPage')) },
      { path: '*', lazy: page(() => import('@/pages/NotFoundPage')) },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: 'daxil-ol', lazy: page(() => import('@/pages/LoginPage')) },
      { path: 'qeydiyyat', lazy: page(() => import('@/pages/RegisterPage')) },
    ],
  },
  {
    element: <WorkflowLayout />,
    children: [
      { path: 'elan-yerlesdir', lazy: page(() => import('@/pages/post-ad/PostAdPage')) },
      { path: 'elan-yerlesdir/gonderildi', lazy: page(() => import('@/pages/post-ad/PostAdSubmittedPage')) },
      { path: 'elan-yerlesdir/:step', lazy: page(() => import('@/pages/post-ad/PostAdPage')) },
    ],
  },
  {
    element: <AdminLayout />,
    children: [
      { path: 'idareetme', lazy: page(() => import('@/pages/admin/ModerationPage')) },
      { path: 'idareetme/moderasiya', lazy: page(() => import('@/pages/admin/ModerationPage')) },
      { path: 'idareetme/kateqoriyalar', lazy: page(() => import('@/pages/admin/CategoriesAdminPage')) },
      { path: 'idareetme/sikayetler', lazy: page(() => import('@/pages/admin/ComplaintsPage')) },
    ],
  },
])
