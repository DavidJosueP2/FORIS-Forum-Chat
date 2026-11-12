import type { ReactNode } from 'react'
import { ForumShell } from '@/features/forum/components/forum-shell'
import { ChatHome } from '@/features/chat/components/chat-home'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '@/features/account/pages/login-page'
import { ProfilePage } from '@/features/account/pages/profile-page'
import { PublicProfilePage } from '@/features/account/pages/public-profile-page'
import { ForumPage } from '@/features/forum/pages/forum-page'
import { CreatePostPage } from '@/features/forum/pages/create-post-page'
import { EditPostPage } from '@/features/forum/pages/edit-post-page'
import { PostPage } from '@/features/forum/pages/post-page'
import { RouteFocus } from '@/components/route-focus'
import { CommunitiesPage } from '@/features/communities/pages/communities-page'
import { CommunityPage } from '@/features/communities/pages/community-page'
import { CreateCommunityPage } from '@/features/communities/pages/create-community-page'
import { NotificationsPage } from '@/features/communities/pages/notifications-page'
import { InvitationPage } from '@/features/communities/pages/invitation-page'
import { usePageTitle } from '@/hooks/use-page-title'

function TitledPage({ title, children }: { title: string; children: ReactNode }) {
  usePageTitle(title)
  return children
}

function App() {
  return (
    <BrowserRouter>
      <RouteFocus />
      <Routes>
        <Route element={<ForumShell />}>
          <Route path="/" element={<ForumPage />} />
          <Route path="/chat" element={<TitledPage title="Chat global"><ChatHome /></TitledPage>} />
          <Route path="/publicar" element={<TitledPage title="Crear publicación"><CreatePostPage /></TitledPage>} />
          <Route path="/publicaciones/:postId" element={<PostPage />} />
          <Route path="/publicaciones/:postId/editar" element={<TitledPage title="Editar publicación"><EditPostPage /></TitledPage>} />
          <Route path="/comunidades" element={<CommunitiesPage />} />
          <Route path="/comunidades/crear" element={<TitledPage title="Crear comunidad"><CreateCommunityPage /></TitledPage>} />
          <Route path="/comunidades/:communityId" element={<CommunityPage />} />
          <Route path="/notificaciones" element={<TitledPage title="Notificaciones"><NotificationsPage /></TitledPage>} />
          <Route path="/invitaciones/:token" element={<TitledPage title="Invitación a una comunidad"><InvitationPage /></TitledPage>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/profile" element={<TitledPage title="Tu perfil"><ProfilePage /></TitledPage>} />
          <Route path="/personas/:userId" element={<PublicProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
