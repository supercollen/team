import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api/index.js';

// UC-N06 가용성: ① 점검 사전 공지 (public/notice.json) ② 인터넷 연결 끊김 안내
// 공지는 홈 화면에서만 보이고(홈에 들어올 때마다 새로 확인), 연결 끊김 안내는 모든 화면에서 보임
// 공지 방법: 관리자 페이지 > 공지, 또는 GitHub에서 frontend/public/notice.json 의 active 를 true 로, message·until 을 바꿔 저장하면 자동 배포 후 모든 사용자에게 표시
export default function SystemBanner() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  const [notice, setNotice] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem('notice_hidden') || ''; } catch { return ''; } });
  useEffect(() => {
    if (!isHome) return;
    // 관리자가 앱에서 올린 공지(DB)를 먼저, 없으면 notice.json. 홈에 들어올 때마다 다시 확인해서 새 공지·내린 공지를 바로 반영
    api.activeNotice().then((n) => n || fetch('/notice.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.active && j.message && (!j.until || new Date(j.until) > new Date()) ? j : null)))
      .then((n) => setNotice(n || null)).catch(() => {});
  }, [isHome]);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  const hide = () => { setHidden(notice.message); try { sessionStorage.setItem('notice_hidden', notice.message); } catch { /* 무시 */ } };
  return (
    <>
      {!online && <div className="sys-banner error" role="alert"><b>📡</b><span>인터넷 연결이 끊겼어요. 연결되면 자동으로 다시 불러와요.</span></div>}
      {isHome && notice && hidden !== notice.message && (
        <div className={`sys-banner ${notice.level || 'warn'}`} role="status"><b>📢</b><span>{notice.message}</span><button onClick={hide} aria-label="공지 닫기">×</button></div>
      )}
    </>
  );
}
