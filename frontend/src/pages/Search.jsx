import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IngPic } from '../components/Pic.jsx';
import { useApp } from '../store.jsx';
import { api } from '../api/index.js';
import Header from '../components/Header.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';
import { SearchI } from '../components/Icons.jsx';
import IngredientChip from '../components/IngredientChip.jsx';
import RecipeSearch from './RecipeSearch.jsx';

const CATS = ['전체', '채소', '육류', '수산물', '기타'];

// 검색 탭: [레시피 검색] 요리 이름·재료로 레시피 찾기 / [재료 담기] 1-② 재료 검색 (UC-B01)
// 하단 탭 '검색' → 레시피 검색, 홈 검색창 → 재료 담기
export default function Search() {
  const [params, setParams] = useSearchParams();
  const mode = params.get('tab') === 'recipe' ? 'recipe' : 'ingredient';
  return (
    <>
      <Header title="검색" />
      <main className="page">
        <div className="seg" role="tablist" aria-label="검색 종류">
          <button role="tab" aria-selected={mode === 'recipe'} onClick={() => setParams({ tab: 'recipe' }, { replace: true })}>레시피 검색</button>
          <button role="tab" aria-selected={mode === 'ingredient'} onClick={() => setParams({ tab: 'ingredient' }, { replace: true })}>재료 담기</button>
        </div>
        {mode === 'recipe' ? <RecipeSearch /> : <IngredientSearch />}
      </main>
    </>
  );
}

// 1-② 재료 검색 (표준 재료 + 별칭 검색, 띄어쓰기로 여러 재료 한 번에 입력)
export function IngredientSearch({ cta = true, autoFocus = true }) {
  const nav = useNavigate();
  const { selected, setSelected, toggleSelected, recent, addRecent, removeRecent, toast } = useApp();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('전체');
  const [list, setList] = useState([]);
  const multi = q.trim().split(/\s+/).filter(Boolean).length > 1;

  useEffect(() => {
    let alive = true;
    if (!multi) api.searchIngredients(q, q.trim() ? '' : cat).then((r) => alive && setList(r));
    return () => { alive = false; };
  }, [q, cat, multi]);

  // 목록에서 + 를 눌러 재료를 고르면 최근 검색어에 기록
  const pick = (i) => {
    const adding = !selected.includes(i.id);
    toggleSelected(i.id);
    if (adding) addRecent([i.id]);
  };
  // 최근 검색어를 누르면 그 재료를 다시 선택 (UC-B03 기본 흐름 2)
  const pickRecent = (id) => {
    if (selected.includes(id)) return toast(`${api.ingredient(id).name}은(는) 이미 선택한 재료예요`);
    toggleSelected(id); addRecent([id]); toast(`${api.ingredient(id).name} 추가했어요`);
  };

  const onEnter = async (e) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    const words = q.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return;
    const added = [], miss = [];
    for (const w of words) {
      const [top] = await api.searchIngredients(w, '');
      const exact = top && (top.name === w || top.matchedAlias === w || words.length === 1);
      if (exact) added.push(top); else miss.push(w);
    }
    setSelected((s) => [...s, ...added.map((a) => a.id).filter((id) => !s.includes(id))]);
    if (added.length) addRecent(added.map((a) => a.id));
    setQ('');
    toast(miss.length ? `${miss.join(', ')}: 등록되지 않은 재료예요` : `${added.map((a) => a.name).join(', ')} 추가했어요`);
  };

  return (
    <>
        <label className="search"><SearchI /><input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onEnter} placeholder="예: 감자 계란 파" autoFocus={autoFocus} /></label>
        {multi ? (
          <div className="notice">띄어쓰기로 여러 재료를 한 번에 넣을 수 있어요. <b>Enter</b>를 누르면 추가돼요.</div>
        ) : (
          <>
            {!q.trim() && (
              <section className="sec">
                <div className="sec-h">
                  <h2>최근 검색어</h2>
                  {recent.length > 0 && <button className="link" onClick={() => { removeRecent(null); toast('최근 검색어를 모두 지웠어요'); }}>전체 삭제</button>}
                </div>
                {recent.length ? (
                  <div className="chips">
                    {recent.map((id) => (
                      <IngredientChip key={id} label={api.ingredient(id).name} selected={selected.includes(id)}
                        onClick={() => pickRecent(id)} onRemove={() => removeRecent(id)} />
                    ))}
                  </div>
                ) : <div className="empty">아직 검색한 재료가 없어요</div>}
              </section>
            )}
            {!q.trim() && (
              <div className="tabs-cat" role="tablist">
                {CATS.map((c) => <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)}>{c}</button>)}
              </div>
            )}
            {list.length ? (
              <div className="tiles">
                {list.map((i) => { const on = selected.includes(i.id); return (
                  <button key={i.id} className={`tile itile${on ? ' on' : ''}`} onClick={() => pick(i)} aria-pressed={on} aria-label={`${i.name} ${on ? '빼기' : '담기'}`}>
                    <IngPic name={i.name} emoji={i.emoji} className="tile-pic" />
                    <span className={`tick${on ? ' on' : ''}`}>{on ? '✓' : '+'}</span>
                    <b>{i.name}</b>
                    <span>{i.matchedAlias ? `'${i.matchedAlias}'로 찾음` : i.category}</span>
                  </button>
                ); })}
              </div>
            ) : <div className="notice warn">'{q}'은(는) 등록되지 않은 재료예요. 다른 이름으로 검색해 보세요.</div>}
          </>
        )}
        {cta && <div className="sticky-cta"><PrimaryButton onClick={() => nav('/fridge')}>내 냉장고 보기 · {selected.length}개</PrimaryButton></div>}
    </>
  );
}
