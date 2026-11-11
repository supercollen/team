import Modal from '../components/Modal.jsx';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';
import { useApp } from '../store.jsx';
import { api } from '../api/index.js';
import { ChevI } from '../components/Icons.jsx';
import { findFridge } from '../data/fridges.js';

// 계정 설정: 닉네임·비밀번호 변경, 이메일 확인, 내 냉장고, 최근 검색어 삭제, 로그아웃, 회원 탈퇴
export default function Account() {
  const nav = useNavigate();
  const { user, recent, removeRecent, toast, fridge } = useApp();
  const myFridge = findFridge(fridge);
  const [profile, setProfile] = useState(null);
  const [nick, setNick] = useState('');
  const [pw, setPw] = useState({ cur: '', next: '', again: '' });
  const [busy, setBusy] = useState('');
  const [sheet, setSheet] = useState('');   // 'logout' | 'delete'
  const [confirmText, setConfirmText] = useState('');
  const live = api.usingSupabase && user;

  useEffect(() => {
    if (!live) return;
    api.user.profile().then((p) => { setProfile(p); setNick(p?.nickname || ''); }).catch(() => {});
  }, [user]);

  const run = async (key, fn) => {
    setBusy(key);
    try { await fn(); } catch (e) { toast(e.message); } finally { setBusy(''); }
  };
  const saveNick = () => run('nick', async () => {
    const n = await api.user.updateNickname(nick);
    setProfile((p) => ({ ...p, nickname: n })); toast('닉네임을 바꿨어요');
  });
  const savePw = () => run('pw', async () => {
    if (pw.next !== pw.again) throw new Error('새 비밀번호가 서로 달라요');
    await api.user.changePassword(pw.cur, pw.next);
    setPw({ cur: '', next: '', again: '' }); toast('비밀번호를 바꿨어요');
  });
  const logout = () => run('out', async () => { await api.user.signOut(); toast('로그아웃했어요'); nav('/my', { replace: true }); });
  const remove = () => run('del', async () => { await api.user.deleteAccount(); toast('탈퇴가 완료됐어요. 그동안 이용해 주셔서 고마워요'); nav('/', { replace: true }); });

  const nickChanged = profile && nick.trim() && nick.trim() !== profile.nickname;
  const pwReady = pw.cur && pw.next.length >= 6 && pw.again;

  return (
    <>
      <Header title="계정 설정" />
      <main className="page">
        {!live && <div className="notice">{api.usingSupabase ? '로그인하면 계정 정보를 바꿀 수 있어요.' : '체험 모드에서는 계정 정보를 바꿀 수 없어요.'}</div>}

        <section className="card-sec">
          <h2>프로필</h2>
          <div className="field">
            <label htmlFor="nick">닉네임</label>
            <div className="inline">
              <input id="nick" value={nick} maxLength={12} disabled={!live} onChange={(e) => setNick(e.target.value)} placeholder="2~12자" />
              <button className="mini" disabled={!nickChanged || busy === 'nick'} onClick={saveNick}>{busy === 'nick' ? '저장 중' : '저장'}</button>
            </div>
          </div>
          <div className="field">
            <label>이메일</label>
            <div className="readonly">{profile?.email || user?.email || '—'}</div>
          </div>
        </section>

        <section className="card-sec">
          <h2>비밀번호 변경</h2>
          <div className="field"><label htmlFor="pw0">현재 비밀번호</label><input id="pw0" type="password" autoComplete="current-password" disabled={!live} value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} /></div>
          <div className="field"><label htmlFor="pw1">새 비밀번호</label><input id="pw1" type="password" autoComplete="new-password" placeholder="6자 이상" disabled={!live} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div>
          <div className="field"><label htmlFor="pw2">새 비밀번호 확인</label><input id="pw2" type="password" autoComplete="new-password" disabled={!live} value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} />
            {pw.again && pw.next !== pw.again && <small className="err">새 비밀번호가 서로 달라요</small>}
          </div>
          <PrimaryButton disabled={!pwReady || busy === 'pw'} onClick={savePw}>{busy === 'pw' ? '변경 중…' : '비밀번호 바꾸기'}</PrimaryButton>
        </section>

        <div className="menu">
          <button onClick={() => nav('/settings')}><span className="mi">🏷️</span><span>냉장고 모델<small className="sub">{myFridge ? `${myFridge.brand} · ${myFridge.size} ${myFridge.type}` : '아직 선택하지 않았어요'}</small></span><ChevI /></button>
          <button disabled={!recent.length} onClick={() => { removeRecent(null); toast('최근 검색어를 모두 지웠어요'); }}><span className="mi">🔍</span><span>최근 검색어 전체 삭제<small className="sub">{recent.length ? `${recent.length}개 저장됨` : '저장된 검색어가 없어요'}</small></span></button>
        </div>

        {live && (
          <div className="menu">
            <button onClick={() => setSheet('logout')}><span className="mi">🚪</span><span>로그아웃</span><ChevI /></button>
            <button className="danger" onClick={() => { setConfirmText(''); setSheet('delete'); }}><span className="mi">⚠️</span><span>회원 탈퇴</span><ChevI /></button>
          </div>
        )}
      </main>

      {sheet && (
        <Modal onClose={() => setSheet('')}>
            {sheet === 'logout' ? (
              <>
                <h3>로그아웃할까요?</h3>
                <p className="muted">찜과 최근 검색어는 계정에 저장돼 있어서 다시 로그인하면 그대로 보여요.</p>
                <div className="btn-row"><PrimaryButton ghost onClick={() => setSheet('')}>취소</PrimaryButton><PrimaryButton disabled={busy === 'out'} onClick={logout}>로그아웃</PrimaryButton></div>
              </>
            ) : (
              <>
                <h3>정말 탈퇴할까요?</h3>
                <p className="muted">내가 등록한 레시피, 찜, 후기, 팔로우가 모두 지워지고 되돌릴 수 없어요. 계속하려면 아래에 <b>탈퇴</b>라고 입력해 주세요.</p>
                <div className="field"><input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="탈퇴" /></div>
                <div className="btn-row"><PrimaryButton ghost onClick={() => setSheet('')}>취소</PrimaryButton><button className="btn danger-btn" disabled={confirmText.trim() !== '탈퇴' || busy === 'del'} onClick={remove}>{busy === 'del' ? '처리 중…' : '탈퇴하기'}</button></div>
              </>
            )}
        </Modal>
      )}
    </>
  );
}
