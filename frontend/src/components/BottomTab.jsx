import { NavLink, useLocation } from 'react-router-dom';
import { HomeI, SearchI, PlusI, HeartI, UserI } from './Icons.jsx';

// 공통 컴포넌트 ① 하단 탭
const TABS = [
  { to: '/', label: '홈', Icon: HomeI, match: ['/', '/fridge', '/results', '/recipes'] },
  { to: '/search?tab=recipe', label: '검색', Icon: SearchI, match: ['/search'] },
  { to: '/register', label: '등록', Icon: PlusI, match: ['/register'] },
  { to: '/favorites', label: '찜', Icon: HeartI, match: ['/favorites'] },
  { to: '/my', label: '마이', Icon: UserI, match: ['/my'] },
];
export default function BottomTab() {
  const { pathname } = useLocation();
  if (pathname.endsWith('/cook')) return null;   // 조리 모드는 화면 전체 사용
  const active = (t) => t.match.some((m) => (m === '/' ? pathname === '/' : pathname.startsWith(m)));
  return (
    <nav className="tabs" aria-label="메뉴">
      {TABS.map((t) => (
        <NavLink key={t.label} to={t.to} className={active(t) ? 'on' : ''} aria-current={active(t) ? 'page' : undefined}>
          <t.Icon />
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
