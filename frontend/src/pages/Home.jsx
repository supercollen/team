import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store.jsx';
import { api } from '../api/index.js';
import IngredientChip from '../components/IngredientChip.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';
import { FoodPic, IngPic } from '../components/Pic.jsx';
import Logo from '../components/Logo.jsx';
import { ClockI, SearchI } from '../components/Icons.jsx';

// 1-① 홈 화면
export default function Home() {
  const nav = useNavigate();
  const { selected, toggleSelected, setSelected, recent, removeRecent, addRecent, unread } = useApp();
  const [hint, setHint] = useState('');
  const [popular, setPopular] = useState([]);
  useEffect(() => { api.popularRecipes().then(setPopular).catch(() => {}); }, []);
  const recommend = () => {
    if (!selected.length) return setHint('재료를 1개 이상 선택해 주세요');
    addRecent(selected); nav('/results');
  };
  return (
    <main className="page">
      <button className="bell" onClick={() => nav('/notifications')} aria-label={`알림${unread ? ` ${unread}개` : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        {unread > 0 && <span className="bell-n">{unread > 9 ? '9+' : unread}</span>}
      </button>
      <div className="brand brand-home"><Logo /><b>냉장고를 부탁해</b><p>냉장고 속 재료로 맛있는 요리를 찾아보세요!</p></div>
      <button className="search search-home" onClick={() => nav('/search')}><SearchI /><span>어떤 재료가 있나요?</span></button>
      <section className="sec">
        <div className="sec-h"><h2>최근 검색어</h2>{recent.length > 0 && <button className="link" onClick={() => removeRecent(null)}>전체 삭제</button>}</div>
        {recent.length ? (
          <div className="chips">{recent.map((id) => <IngredientChip key={id} label={api.ingredient(id).name} selected={selected.includes(id)} onClick={() => toggleSelected(id)} />)}</div>
        ) : <div className="empty">아직 검색한 재료가 없어요</div>}
      </section>
      <section className="sec">
        <div className="sec-h"><h2>내 냉장고 <span className="count">{selected.length}</span></h2><button className="link" onClick={() => nav('/fridge')}>열기 ›</button></div>
        <div className="fridge tap" onClick={(e) => !e.target.closest('.rm') && nav('/fridge')} role="button" tabIndex={0} aria-label="내 냉장고 열기" onKeyDown={(e) => e.key === 'Enter' && nav('/fridge')}>
          {selected.map((id) => { const i = api.ingredient(id); return (
            <div key={id} className="fitem"><IngPic name={i.name} emoji={i.emoji} className="ico" /><span className="fname">{i.name}</span><button className="rm" onClick={() => toggleSelected(id)} aria-label={`${i.name} 빼기`}>×</button></div>
          ); })}
          <button className="fitem add" onClick={() => nav('/fridge')}><span className="ico">+</span><span className="fname">재료 담기</span></button>
        </div>
      </section>
      {hint && <p className="hint">{hint}</p>}
      <PrimaryButton onClick={recommend}>요리 추천받기{selected.length > 0 && ` · 재료 ${selected.length}개`}</PrimaryButton>
      {popular.length > 0 && (
        <section className="sec">
          <div className="sec-h"><h2>지금 인기 있는 레시피</h2><button className="link" onClick={() => nav('/search?tab=recipe')}>더 보기</button></div>
          <div className="hscroll">
            {popular.map((r) => (
              <button key={r.recipeId} className="pcard" onClick={() => nav(`/recipes/${r.recipeId}`)}>
                <FoodPic r={r} size="md" />
                <b>{r.title}</b>
                <span className="meta"><span><ClockI /> {r.cookingTime}분</span><span className="star">★ {Number(r.averageRating).toFixed(1)}</span></span>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
