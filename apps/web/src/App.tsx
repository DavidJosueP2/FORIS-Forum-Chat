import { ChatHome } from '@/features/chat/components/chat-home'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '@/features/account/pages/login-page'
import { ProfilePage } from '@/features/account/pages/profile-page'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChatHome />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
