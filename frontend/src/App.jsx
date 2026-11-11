import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import SystemBanner from './components/SystemBanner.jsx';
import BottomTab from './components/BottomTab.jsx';
import Toast from './components/Toast.jsx';
import Home from './pages/Home.jsx';
import Fridge from './pages/Fridge.jsx';
import Search from './pages/Search.jsx';
import Results from './pages/Results.jsx';
import RecipeDetail from './pages/RecipeDetail.jsx';
const Cook = lazy(() => import('./pages/Cook.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const Favorites = lazy(() => import('./pages/Favorites.jsx'));
const MyPage = lazy(() => import('./pages/MyPage.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Account = lazy(() => import('./pages/Account.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));

// 화면 번호는 UI/UX 화면 흐름도 기준
// 첫 화면에 필요한 화면(홈·검색·추천·상세)만 먼저 받고, 나머지는 열 때 받아 첫 로딩을 줄임 (UC-N01)
export default function App() {
  const { pathname } = useLocation();
  return (
    <div className="app">
      <SystemBanner />
      <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<div className="route-wait"><div className="sk" style={{ height: 180 }} /></div>}>
      <Routes>
        <Route path="/" element={<Home />} />                       {/* 1-① 홈 */}
        <Route path="/search" element={<Search />} />               {/* 1-② 재료 검색 */}
        <Route path="/fridge" element={<Fridge />} />               {/* 1-③ 내 냉장고: 재료 선택 + 선택한 재료 */}
        <Route path="/selected" element={<Navigate to="/fridge" replace />} />
        <Route path="/settings" element={<Settings />} />          {/* 냉장고 모델 선택 (삼성·LG 소형·중형·대형) */}
        <Route path="/results" element={<Results />} />             {/* 1-④ 추천 요리 목록 */}
        <Route path="/recipes/:id" element={<RecipeDetail />} />    {/* 1-⑤ 레시피 상세 */}
        <Route path="/recipes/:id/cook" element={<Cook />} />       {/* 1-⑥ 조리 방법 */}
        <Route path="/register" element={<Register />} />           {/* 2 레시피 등록 1~4단계 */}
        <Route path="/favorites" element={<Favorites />} />         {/* 3 찜 목록 */}
        <Route path="/my" element={<MyPage />} />                   {/* 4 마이페이지 */}
        <Route path="/login" element={<Login />} />                {/* UC-A01·A02 회원가입·로그인 */}
        <Route path="/notifications" element={<Notifications />} />  {/* UC-F05 레시피 알림 */}
        <Route path="/admin" element={<Admin />} />                  {/* UC-G02 관리자 재료 관리 */}
        <Route path="/account" element={<Account />} />            {/* 계정 설정 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      </ErrorBoundary>
      <BottomTab />
      <Toast />
      <div className="rotate-lock" aria-hidden="true"><div>📱</div><b>세로 화면으로 돌려주세요</b><span>이 앱은 세로 모드에서만 사용할 수 있어요</span></div>
    </div>
  );
}
