import { createBrowserRouter } from 'react-router'
import { AdminLayout, AuthLayout, HomeLayout, MainLayout, WorkflowLayout } from '@/layouts/Layouts'
import HomePage from '@/pages/HomePage'
import SearchPage from '@/pages/SearchPage'
import ListingDetailPage from '@/pages/ListingDetailPage'
import SellerPage from '@/pages/SellerPage'
import ServicesPage from '@/pages/ServicesPage'
import ServiceDetailPage from '@/pages/ServiceDetailPage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import DashboardPage from '@/pages/account/DashboardPage'
import ProfilePage from '@/pages/account/ProfilePage'
import FavoritesPage from '@/pages/account/FavoritesPage'
import PostAdPage from '@/pages/post-ad/PostAdPage'
import PostAdSubmittedPage from '@/pages/post-ad/PostAdSubmittedPage'
import ModerationPage from '@/pages/admin/ModerationPage'
import CategoriesAdminPage from '@/pages/admin/CategoriesAdminPage'
import ComplaintsPage from '@/pages/admin/ComplaintsPage'
import NotFoundPage from '@/pages/NotFoundPage'

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
      { path: 'elanlar', element: <SearchPage /> },
      { path: 'elanlar/:slug', element: <ListingDetailPage /> },
      { path: 'saticilar/:slug', element: <SellerPage /> },
      { path: 'xidmetler', element: <ServicesPage /> },
      { path: 'xidmetler/:slug', element: <ServiceDetailPage /> },
      { path: 'kabinet', element: <DashboardPage /> },
      { path: 'kabinet/profil', element: <ProfilePage /> },
      { path: 'secilmisler', element: <FavoritesPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: 'daxil-ol', element: <LoginPage /> },
      { path: 'qeydiyyat', element: <RegisterPage /> },
    ],
  },
  {
    element: <WorkflowLayout />,
    children: [
      { path: 'elan-yerlesdir', element: <PostAdPage /> },
      { path: 'elan-yerlesdir/gonderildi', element: <PostAdSubmittedPage /> },
      { path: 'elan-yerlesdir/:step', element: <PostAdPage /> },
    ],
  },
  {
    element: <AdminLayout />,
    children: [
      { path: 'idareetme', element: <ModerationPage /> },
      { path: 'idareetme/moderasiya', element: <ModerationPage /> },
      { path: 'idareetme/kateqoriyalar', element: <CategoriesAdminPage /> },
      { path: 'idareetme/sikayetler', element: <ComplaintsPage /> },
    ],
  },
])
