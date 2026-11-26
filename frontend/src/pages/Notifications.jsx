import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';
import { useApp } from '../store.jsx';
import { api } from '../api/index.js';
import { ago } from '../components/Reviews.jsx';

// UC-F05 레시피 알림: 팔로우한 업로더가 새 레시피를 올리면 도착
// UC-N06 공지: 관리자가 올린 공지를 탭으로 모아 보기 (로그인 없이도 볼 수 있음)
const TABS = [{ key: 'alert', label: '알림' }, { key: 'notice', label: '공지' }];

export default function Notifications() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'notice' ? 'notice' : 'alert';
  const setTab = (t) => setParams(t === 'notice' ? { tab: 'notice' } : {}, { replace: true });
  return (
    <>
      <Header title="알림" />
      <div className="tabs-cat nt-tabs" role="tablist">
        {TABS.map((t) => <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>{t.label}</button>)}
      </div>
      <main className="page">
        {tab === 'notice' ? <NoticeList /> : <AlertList />}
      </main>
    </>
  );
}

function AlertList() {
  const nav = useNavigate();
  const { user, setUnread } = useApp();
  const [list, setList] = useState(null);
  useEffect(() => {
    api.notifications().then((l) => { setList(l); if (l.some((n) => !n.isRead)) api.markAllRead().then(() => setUnread(0)); }).catch(() => setList([]));
  }, [user]);
  const remove = async (id) => { await api.deleteNotification(id).catch(() => {}); setList((l) => l.filter((n) => n.id !== id)); };
  if (api.usingSupabase && !user) return (
    <>
      <div className="empty">로그인하면 팔로우한 업로더의 새 레시피 알림을 받을 수 있어요</div>
      <PrimaryButton onClick={() => nav('/login')}>로그인하기</PrimaryButton>
    </>
  );
  if (list === null) return <div className="sk" style={{ height: 120 }} />;
  if (!list.length) return <div className="empty">아직 알림이 없어요.<br />마음에 드는 업로더를 팔로우하면 새 레시피를 알려 드려요.</div>;
  return (
    <div className="nt-list">
      {list.map((n) => (
        <div key={n.id} className={`nt${n.isRead ? '' : ' new'}`}>
          <button className="nt-main" onClick={() => n.relatedType === 'RECIPE' && nav(`/recipes/${n.relatedId}`)}>
            <span className="nt-ic">🍳</span>
            <span className="nt-tx"><span>{n.message}</span><span className="muted small">{ago(n.createdAt)}</span></span>
          </button>
          <button className="nt-del" onClick={() => remove(n.id)} aria-label="알림 삭제">×</button>
        </div>
      ))}
    </div>
  );
}

const fmt = (d) => { const x = new Date(d); return `${x.getFullYear()}.${x.getMonth() + 1}.${x.getDate()}`; };

function NoticeList() {
  const [list, setList] = useState(null);
  useEffect(() => {
    const now = new Date().toISOString();
    // 시작 전인 예약 공지는 빼고, 진행 중인 공지를 먼저
    api.notices().then((l) => {
      const shown = l.filter((n) => !n.startsAt || n.startsAt <= now).map((n) => ({ ...n, live: !n.endsAt || n.endsAt > now }));
      setList([...shown.filter((n) => n.live), ...shown.filter((n) => !n.live)]);
    }).catch(() => setList([]));
  }, []);
  if (list === null) return <div className="sk" style={{ height: 120 }} />;
  if (!list.length) return <div className="empty">아직 공지가 없어요</div>;
  return (
    <div className="nt-list">
      {list.map((n) => (
        <div key={n.id} className={`nt notice${n.live ? '' : ' ended'}`}>
          <span className="nt-ic">📢</span>
          <span className="nt-tx">
            <span>{n.message}</span>
            <span className="muted small">{fmt(n.startsAt || n.createdAt)}{n.endsAt ? ` ~ ${fmt(n.endsAt)}` : ''}</span>
          </span>
          <span className={`nt-state${n.live ? ' on' : ''}`}>{n.live ? '진행 중' : '종료'}</span>
        </div>
      ))}
    </div>
  );
}
