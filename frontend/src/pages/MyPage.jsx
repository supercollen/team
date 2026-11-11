import Modal from '../components/Modal.jsx';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store.jsx';
import { api } from '../api/index.js';
import RecipeCard from '../components/RecipeCard.jsx';
import { FridgeI, PlusI, SearchI, UserI } from '../components/Icons.jsx';
import { findFridge } from '../data/fridges.js';
import PrimaryButton from '../components/PrimaryButton.jsx';
import { FoodPic } from '../components/Pic.jsx';

// 4 마이페이지
export default function MyPage() {
  const nav = useNavigate();
  const { user, favorites, following, recent, removeRecent, toast, selected, unread, isAdmin, fridge } = useApp();
  const myFridge = findFridge(fridge);
  const [profile, setProfile] = useState(null);
  const [mine, setMine] = useState([]);
  const [open, setOpen] = useState('');
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const doDelete = async () => {
    setBusy(true);
    try { await api.deleteRecipe(del.recipeId, del.mainPhoto); setMine((m) => m.filter((x) => x.recipeId !== del.recipeId)); toast('레시피를 삭제했어요'); setDel(null); }
    catch (e) { toast(e.message); } finally { setBusy(false); }
  };
  const sum = (k) => mine.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  useEffect(() => { api.myRecipes().then(setMine); if (user) api.user.profile().then(setProfile).catch(() => {}); else setProfile(null); }, [user]);
  return (
    <>
      <header className="top"><h1 style={{ paddingLeft: 4 }}>마이페이지</h1></header>
      <main className="page">
        <div className="profile">
          <div className="avatar">🧑‍🍳</div>
          {api.usingSupabase && !user ? (
            <div><b>로그인이 필요해요</b><div className="muted small">찜 · 레시피 등록 · 팔로우는 로그인 후 사용할 수 있어요</div></div>
          ) : (
            <div><b>{profile?.nickname || '체험 사용자'}</b><div className="muted small">{profile?.email || '로그인 없이 체험 중'}</div></div>
          )}
        </div>
        {api.usingSupabase && !user && <button className="btn" onClick={() => nav('/login')}>로그인 · 회원가입</button>}
        <div className="stats"><div><b>{mine.length}</b><span>내 레시피</span></div><div><b>{following.length}</b><span>팔로잉</span></div><button onClick={() => nav('/favorites')}><b>{favorites.length}</b><span>찜</span></button></div>
        <p className="tile-cap">내 활동과 설정을 한 번에 관리하세요</p>
        <div className="tiles">
          <button className={`tile${open === 'mine' ? ' on' : ''}`} onClick={() => setOpen(open === 'mine' ? '' : 'mine')}><PlusI /><b>내 레시피</b><span>등록한 레시피 {mine.length}개</span></button>
          <button className={`tile${open === 'recent' ? ' on' : ''}`} onClick={() => setOpen(open === 'recent' ? '' : 'recent')}><SearchI /><b>최근 검색어</b><span>{recent.length ? `재료 ${recent.length}개` : '아직 없어요'}</span></button>
          <button className="tile" onClick={() => nav('/fridge')}><FridgeI /><b>내 냉장고</b><span>{selected.length ? `재료 ${selected.length}개` : '재료 담기'}</span></button>
          <button className="tile" onClick={() => nav('/settings')}><span className="tile-emo">🏷️</span><b>냉장고 모델</b><span>{myFridge ? `${myFridge.brand} · ${myFridge.size} ${myFridge.type}` : '삼성·LG 모델 선택'}</span></button>
          <button className="tile" onClick={() => (api.usingSupabase && !user ? nav('/login') : nav('/account'))}><UserI /><b>계정 설정</b><span>닉네임·비밀번호</span></button>
          <button className="tile" onClick={() => nav('/notifications')}><span className="tile-emo">🔔</span><b>알림</b><span>{unread ? `새 알림 ${unread}개` : '새 레시피 소식'}</span></button>
          {isAdmin && <button className="tile admin" onClick={() => nav('/admin')}><span className="tile-emo">🛠️</span><b>관리자 페이지</b><span>신고·레시피·재료·공지</span></button>}
        </div>
        {open === 'mine' && (mine.length ? (
          <div className="sec">
            <div className="my-sum"><div><b>{sum('views').toLocaleString()}</b><span>총 조회수</span></div><div><b>{sum('saves')}</b><span>총 저장수</span></div><div><b>{(mine.filter((r) => r.averageRating > 0).reduce((a, r, _, arr) => a + r.averageRating / arr.length, 0) || 0).toFixed(1)}</b><span>평균 평점</span></div></div>
            {mine.map((r) => (
              <div key={r.recipeId} className="my-rc">
                <button className="my-rc-main" onClick={() => nav(`/recipes/${r.recipeId}`)}>
                  <span className="my-rc-pic"><FoodPic r={r} size="sm" /></span>
                  <span className="my-rc-tx"><b>{r.title}</b>
                    <span className="my-rc-stats"><span>👀 {Number(r.views || 0).toLocaleString()}</span><span>❤️ {r.saves || 0}</span><span>★ {Number(r.averageRating || 0).toFixed(1)}</span></span>
                  </span>
                </button>
                <span className="my-rc-btns"><button className="my-rc-edit" onClick={() => nav(`/register?edit=${r.recipeId}`)}>수정</button><button className="my-rc-del" onClick={() => setDel(r)}>삭제</button></span>
              </div>
            ))}
          </div>
        ) : <div className="empty">아직 등록한 레시피가 없어요</div>)}
        {open === 'recent' && (
          <div className="sec">
            <div className="chips">{recent.map((id) => <span key={id} className="chip">{api.ingredient(id).name}</span>)}</div>
            {recent.length > 0 && <button className="link" onClick={() => removeRecent(null)}>최근 검색어 전체 삭제</button>}
          </div>
        )}
      </main>
      {del && (
        <Modal onClose={() => setDel(null)}>
            <h3>'{del.title}'을(를) 삭제할까요?</h3>
            <p className="muted">조리 단계, 재료, 사진, 찜·후기·질문까지 함께 지워지고 되돌릴 수 없어요.</p>
            <div className="btn-row"><PrimaryButton ghost onClick={() => setDel(null)}>취소</PrimaryButton><button className="btn danger-btn" disabled={busy} onClick={doDelete}>{busy ? '삭제 중…' : '삭제하기'}</button></div>
        </Modal>
      )}
    </>
  );
}
