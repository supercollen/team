import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header.jsx';
import RecipeTile from '../components/RecipeTile.jsx';
import { useApp } from '../store.jsx';
import { api } from '../api/index.js';

// 업로더 페이지: 닉네임·팔로워 수·팔로우 버튼, 지금까지 올린 레시피 목록
export default function UserPage() {
  const { key } = useParams();
  const nav = useNavigate();
  const { user, following, toggleFollow } = useApp();
  const [u, setU] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { setErr(''); api.userPage(decodeURIComponent(key)).then(setU).catch((e) => setErr(e.message)); }, [key]);
  if (err) return <><Header title="" /><main className="page"><div className="crash" style={{ minHeight: '50vh' }}><div className="ic">🧑‍🍳</div><h2>{err}</h2><button className="btn" onClick={() => nav(-1)}>돌아가기</button></div></main></>;
  if (!u) return <><Header title="" /><main className="page"><div className="sk" style={{ height: 90 }} /><div className="sk" style={{ height: 220 }} /></main></>;
  const me = (user && user.id === u.writerId) || u.nickname === '나';
  const fol = following.includes(u.writerId || u.nickname);
  const followers = u.followers + (fol && !u.writerId ? 1 : 0);
  return (
    <>
      <Header title={u.nickname} />
      <main className="page">
        <div className="up-head">
          <span className="avatar">👩‍🍳</span>
          <div className="up-tx"><b>{u.nickname}</b><span>레시피 {u.recipes.length} · 팔로워 {followers}</span></div>
          {!me && <button className={`follow${fol ? ' on' : ''}`} onClick={() => toggleFollow(u.nickname, u.writerId)}>{fol ? '팔로잉' : '팔로우'}</button>}
        </div>
        <section className="sec">
          <div className="sec-h"><h2>올린 레시피 <span className="count">{u.recipes.length}</span></h2></div>
          {u.recipes.length ? <div className="tiles">{u.recipes.map((r) => <RecipeTile key={r.recipeId} r={r} />)}</div> : <div className="empty">아직 올린 레시피가 없어요</div>}
        </section>
      </main>
    </>
  );
}
