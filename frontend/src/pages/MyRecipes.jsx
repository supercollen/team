import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store.jsx';
import { api } from '../api/index.js';
import Header from '../components/Header.jsx';
import Modal from '../components/Modal.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';
import { FoodPic } from '../components/Pic.jsx';

// UC-E03 내 레시피 관리: 조회수·저장수·평점 + 수정·삭제 (UC-E02)
export default function MyRecipes() {
  const nav = useNavigate();
  const { user, toast } = useApp();
  const [mine, setMine] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.myRecipes().then(setMine).catch((e) => { toast(e.message); setMine([]); }); }, [user]);
  const doDelete = async () => {
    setBusy(true);
    try { await api.deleteRecipe(del.recipeId, del.mainPhoto); setMine((m) => m.filter((x) => x.recipeId !== del.recipeId)); toast('레시피를 삭제했어요'); setDel(null); }
    catch (e) { toast(e.message); } finally { setBusy(false); }
  };
  const sum = (k) => (mine || []).reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const rated = (mine || []).filter((r) => r.averageRating > 0);
  if (api.usingSupabase && !user) return (
    <><Header title="내 레시피" /><main className="page"><div className="empty">로그인하면 내가 등록한 레시피를 관리할 수 있어요</div><PrimaryButton onClick={() => nav('/login')}>로그인하기</PrimaryButton></main></>
  );
  return (
    <>
      <Header title="내 레시피" right={<button className="link" onClick={() => nav('/register')}>+ 등록</button>} />
      <main className="page">
        {mine === null ? <div className="sk" style={{ height: 160 }} /> : mine.length ? (
          <>
            <div className="my-sum"><div><b>{sum('views').toLocaleString()}</b><span>총 조회수</span></div><div><b>{sum('saves')}</b><span>총 저장수</span></div><div><b>{rated.length ? (rated.reduce((a, r) => a + Number(r.averageRating), 0) / rated.length).toFixed(1) : '-'}</b><span>평균 평점</span></div></div>
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
          </>
        ) : (
          <>
            <div className="empty">아직 등록한 레시피가 없어요.<br />나만의 레시피를 올려 보세요!</div>
            <PrimaryButton onClick={() => nav('/register')}>레시피 등록하기</PrimaryButton>
          </>
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
