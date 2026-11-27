import Modal from '../components/Modal.jsx';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../store.jsx';
import { api } from '../api/index.js';
import Header from '../components/Header.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';
import Reviews from '../components/Reviews.jsx';
import Comments from '../components/Comments.jsx';
import { FoodPic, IngPic } from '../components/Pic.jsx';
import { ClockI, FlagI, HeartI, ShareI } from '../components/Icons.jsx';

const FR = { 0.2: '1/5', 0.25: '1/4', 0.3: '1/3', 0.33: '1/3', 0.5: '1/2', 0.67: '2/3', 0.75: '3/4' };
const COUNT = ['개', '대', '모', '마리', '장', '컵', '공기'];
// 인분 환산: 재료 양 × (바꾼 인분 ÷ 기본 인분)
export function scaled(q, unit, serv, base) {
  if (q == null || unit === '약간') return '약간';
  const n = (q * serv) / base, w = Math.floor(n), f = +(n - w).toFixed(2);
  const num = f === 0 ? String(w) : FR[f] ? `${w ? w + ' ' : ''}${FR[f]}` : String(+n.toFixed(1));
  return num + (COUNT.includes(unit) ? unit : ' ' + unit);
}

// 1-⑤ 레시피 상세
export default function RecipeDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, needLogin, selected, favorites, toggleFavorite, following, toggleFollow, toast, isAdmin } = useApp();
  const [adm, setAdm] = useState(null);
  const adminDo = async (action) => {
    try {
      await api.adminResolve('RECIPE', r.recipeId, action, action === 'restore' ? null : '관리자 판단');
      setAdm(null);
      if (action === 'delete') { toast('레시피를 삭제했어요'); nav(-1); return; }
      setR((x) => ({ ...x, isHidden: action === 'hide', hiddenReason: action === 'hide' ? '관리자 판단' : null })); toast(action === 'hide' ? '레시피를 숨겼어요' : '숨김을 해제했어요');
    } catch (e) { toast(e.message); }
  };
  const [r, setR] = useState(null);
  const [serv, setServ] = useState(2);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('부적절한 내용');
  const [deleting, setDeleting] = useState(false);
  const [zoom, setZoom] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  useEffect(() => { setLoadErr(''); api.getRecipe(id).then((d) => { if (!d) throw new Error('레시피를 찾을 수 없어요'); setR(d); setServ(d.servings); }).catch((e) => setLoadErr(/찾을 수 없|not found|P0002|PGRST116/i.test(e.message) ? '레시피를 찾을 수 없어요' : e.message || '레시피를 불러오지 못했어요')); }, [id]);
  if (loadErr) return (
    <><Header title="" /><main className="page"><div className="crash" role="alert" style={{ minHeight: '50vh' }}>
      <div className="ic">🍳</div><h2>{loadErr}</h2><p>삭제되었거나 숨김 처리된 레시피일 수 있어요.</p>
      <button className="btn" onClick={() => nav('/', { replace: true })}>홈으로</button>
      <button className="link" onClick={() => nav('/search?tab=recipe')}>다른 레시피 찾기</button>
    </div></main></>
  );
  if (!r) return <><Header title="" /><main className="page"><div className="sk sk-hero" /><div className="sk" style={{ height: 26, width: '55%' }} /><div className="sk" style={{ height: 70 }} /><div className="sk" style={{ height: 180 }} /></main></>;
  const fav = favorites.includes(r.recipeId), fol = following.includes(r.writerId || r.writer);
  const mine = r.writer === '나' || (user && user.id === r.writerId);
  // 공유: 폰에서는 공유 창(카카오톡·문자 등)을 열고, 안 되면 레시피 주소를 복사
  const share = async () => {
    const url = `${window.location.origin}/recipes/${r.recipeId}`;
    const text = `${r.title} 레시피 · 냉장고를 부탁해`;
    if (navigator.share) {
      try { await navigator.share({ title: text, text, url }); return; }
      catch (e) { if (e?.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); }
    catch {
      const t = document.createElement('textarea'); t.value = url; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove();
      if (!ok) return toast('복사할 수 없는 환경이에요');
    }
    toast('레시피 주소를 복사했어요. 원하는 곳에 붙여 넣어 공유하세요');
  };
  const removeRecipe = async () => {
    try { await api.deleteRecipe(r.recipeId, r.mainPhoto); toast('레시피를 삭제했어요'); nav('/my', { replace: true }); }
    catch (e) { toast(e.message); setDeleting(false); }
  };
  const sendReport = async () => {
    try { await api.report('RECIPE', r.recipeId, reason); toast('신고가 접수됐어요. 관리자가 확인 후 처리해요'); }
    catch (e) { toast(e.message); }
    setReporting(false);
  };
  return (
    <>
      <Header title="" right={<button className="iconbtn" style={{ color: fav ? 'var(--heart)' : undefined }} onClick={() => toggleFavorite(r.recipeId)} aria-label="찜하기"><HeartI filled={fav} /></button>} />
      <main className="page detail">
        {r.isHidden && <div className="hid-banner">🙈 관리자에 의해 숨김 처리된 레시피예요{r.hiddenReason ? ` (사유: ${r.hiddenReason})` : ''}. 작성자와 관리자만 볼 수 있어요.</div>}
        {isAdmin && !mine && (
          <div className="adm-bar"><span>🛠️ 관리자</span>
            {r.isHidden ? <button onClick={() => adminDo('restore')}>숨김 해제</button> : <button onClick={() => setAdm('hide')}>숨기기</button>}
            <button className="d" onClick={() => setAdm('delete')}>삭제</button>
          </div>
        )}
        <FoodPic r={r} size="lg" extras={r.mainPhoto ? [] : r.ingredients.filter((x) => !x.isSeasoning && x.name !== r.title)} />
        <section className="sec title-sec">
          {r.category && <span className="cat">{r.category}</span>}
          <h2 className="title-lg">{r.title}</h2>
          {r.intro && <p className="intro">{r.intro}</p>}
          <div className="facts">
            <div><ClockI /><b>{r.cookingTime}분</b><span>조리시간</span></div>
            <div><span className="fi-ic">🔥</span><b>{r.difficulty}</b><span>난이도</span></div>
            <div><span className="fi-ic">★</span><b>{Number(r.averageRating).toFixed(1)}</b><span>평점</span></div>
            <div><span className="fi-ic">👀</span><b>{r.views.toLocaleString()}</b><span>조회</span></div>
          </div>
        </section>
        <div className="author">
          <div className="avatar">👩‍🍳</div>
          <button className="who" onClick={() => nav(`/users/${encodeURIComponent(r.writerId || r.writer)}`)}><b>{r.writer} ›</b><span className="muted small">레시피 작성자</span></button>
          {!mine && <button className={`follow${fol ? ' on' : ''}`} onClick={() => toggleFollow(r.writer, r.writerId)}>{fol ? '팔로잉' : '팔로우'}</button>}
        </div>
        <div className="actions">
          {mine
            ? <button onClick={() => nav(`/register?edit=${r.recipeId}`)}><span className="act-emo">✏️</span>수정</button>
            : <button className={fav ? 'on' : ''} onClick={() => toggleFavorite(r.recipeId)}><HeartI filled={fav} />찜하기</button>}
          <button onClick={share}><ShareI />공유하기</button>
          {mine
            ? <button className="del" onClick={() => setDeleting(true)}><span className="act-emo">🗑️</span>삭제</button>
            : <button onClick={() => !needLogin('신고') && setReporting(true)}><FlagI />신고하기</button>}
        </div>
        <section className="sec">
          <div className="sec-h">
            <h2>필요한 재료</h2>
            <div className="stepper">
              <button onClick={() => setServ((s) => Math.max(1, s - 1))} aria-label="인분 줄이기">−</button>
              <output>{serv}인분</output>
              <button onClick={() => setServ((s) => Math.min(10, s + 1))} aria-label="인분 늘리기">+</button>
            </div>
          </div>
          {[['주재료', r.ingredients.filter((x) => !x.isSeasoning)], ['양념', r.ingredients.filter((x) => x.isSeasoning)]].map(([label, list]) => list.length > 0 && (
            <div key={label} className="ing-group">
              <div className="ing-label">{label}{label === '주재료' && <span className="muted small"> · 보유 {list.filter((x) => selected.includes(x.ingredientId)).length}/{list.length}</span>}</div>
              {list.map((x) => (
                <div key={x.ingredientId} className="ing">
                  <IngPic name={x.name} emoji={x.emoji} className="e" />
                  <span className="n">{x.name}{!x.isSeasoning && <span className={`tag ${selected.includes(x.ingredientId) ? 'have' : 'need'}`}>{selected.includes(x.ingredientId) ? '보유' : '부족'}</span>}
                    {!selected.includes(x.ingredientId) && api.ingredient(x.ingredientId).substituteInfo && <small className="subst">대체: {api.ingredient(x.ingredientId).substituteInfo}</small>}</span>
                  <span className="a">{scaled(x.quantity, x.unit, serv, r.servings)}</span>
                </div>
              ))}
            </div>
          ))}
        </section>
        {r.tip && <div className="tipbox"><b>💡 요리 팁</b><p>{r.tip}</p></div>}
        <section className="sec">
          <div className="sec-h"><h2>조리 순서 <span className="count">{r.steps.length}</span></h2></div>
          <ol className="preview">
            {r.steps.map((s) => (
              <li key={s.stepNumber}><span className="num">{s.stepNumber}</span>
                <div className="pv-body"><p>{s.description}</p>
                  {s.stepPhoto && <button className="pv-photo" onClick={() => setZoom(s.stepPhoto)}><img src={s.stepPhoto} alt={`${s.stepNumber}단계 사진`} loading="lazy" /></button>}
                </div>
              </li>
            ))}
          </ol>
        </section>
        <Reviews recipeId={r.recipeId} mineRecipe={mine} onRating={(v) => setR((x) => ({ ...x, averageRating: v }))} />
        <Comments recipeId={r.recipeId} writerId={r.writerId} writer={r.writer} />
        <div className="sticky-cta"><PrimaryButton onClick={() => nav(`/recipes/${r.recipeId}/cook`)}>요리 시작하기</PrimaryButton></div>
      </main>
      {zoom && <Modal zoom onClose={() => setZoom(null)}><img src={zoom} alt="단계 사진 크게 보기" /></Modal>}
      {deleting && (
        <Modal onClose={() => setDeleting(false)}>
            <h3>이 레시피를 삭제할까요?</h3>
            <p className="muted">조리 단계, 재료, 사진, 찜·후기·질문까지 함께 지워지고 되돌릴 수 없어요.</p>
            <div className="btn-row"><PrimaryButton ghost onClick={() => setDeleting(false)}>취소</PrimaryButton><button className="btn danger-btn" onClick={removeRecipe}>삭제하기</button></div>
        </Modal>
      )}
      {adm && (
        <Modal onClose={() => setAdm(null)}>
          <h3>관리자 권한으로 {adm === 'hide' ? '숨길까요?' : '삭제할까요?'}</h3>
          <p className="muted">{adm === 'hide' ? '다른 사용자에게 보이지 않게 되고 작성자에게 알림이 가요.' : '레시피와 단계·후기·댓글이 모두 지워지고 되돌릴 수 없어요. 작성자에게 알림이 가요.'}</p>
          <div className="btn-row"><PrimaryButton ghost onClick={() => setAdm(null)}>취소</PrimaryButton><button className={`btn${adm === 'delete' ? ' danger-btn' : ''}`} onClick={() => adminDo(adm)}>{adm === 'hide' ? '숨기기' : '삭제'}</button></div>
        </Modal>
      )}
      {reporting && (
        <Modal onClose={() => setReporting(false)}>
            <h3>이 레시피를 신고할까요?</h3>
            {['부적절한 내용', '저작권 침해', '광고 · 스팸', '기타'].map((x) => (
              <label key={x} className="radio"><input type="radio" name="rp" checked={reason === x} onChange={() => setReason(x)} />{x}</label>
            ))}
            <div className="btn-row"><PrimaryButton ghost onClick={() => setReporting(false)}>취소</PrimaryButton><PrimaryButton onClick={sendReport}>신고하기</PrimaryButton></div>
        </Modal>
      )}
    </>
  );
}
