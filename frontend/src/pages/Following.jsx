import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';
import { useApp } from '../store.jsx';
import { api } from '../api/index.js';
import { ChevI } from '../components/Icons.jsx';

// UC-F03 팔로잉 목록: 누르면 그 업로더가 올린 레시피 화면
export default function Following() {
  const nav = useNavigate();
  const { user, following, toggleFollow } = useApp();
  const [list, setList] = useState(null);
  useEffect(() => { api.followingList().then(setList).catch(() => setList([])); }, [user, following.length]);
  if (api.usingSupabase && !user) return (
    <><Header title="팔로잉" /><main className="page"><div className="empty">로그인하면 팔로우한 업로더를 볼 수 있어요</div><PrimaryButton onClick={() => nav('/login')}>로그인하기</PrimaryButton></main></>
  );
  return (
    <>
      <Header title={`팔로잉 ${list ? list.length : ''}`} />
      <main className="page">
        {list === null ? <div className="sk" style={{ height: 140 }} /> : list.length ? (
          <div className="fl-list">
            {list.map((u) => (
              <div key={u.key} className="fl-row">
                <button className="fl-main" onClick={() => nav(`/users/${encodeURIComponent(u.key)}`)}>
                  <span className="avatar sm">👩‍🍳</span>
                  <span className="fl-tx"><b>{u.nickname}</b><span>레시피 {u.recipes}개</span></span>
                  <ChevI />
                </button>
                <button className="follow on" onClick={() => toggleFollow(u.nickname, u.writerId)}>팔로잉</button>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="empty">아직 팔로우한 업로더가 없어요.<br />레시피 상세에서 마음에 드는 업로더를 팔로우해 보세요.</div>
            <PrimaryButton ghost onClick={() => nav('/search?tab=recipe')}>레시피 둘러보기</PrimaryButton>
          </>
        )}
      </main>
    </>
  );
}
