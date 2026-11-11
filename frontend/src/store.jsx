import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from './api/index.js';

// 앱 전역 상태: 로그인 사용자, 선택 재료, 최근 검색어, 찜, 팔로우
// 로그인하면 찜·팔로우·최근 검색어·내 냉장고 재료를 DB와 동기화 (로그인 전에는 이 기기에 저장)
const Ctx = createContext(null);
const load = (k, d) => { try { const v = localStorage.getItem('fridge_' + k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem('fridge_' + k, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } };
function usePersist(key, init) {
  const [v, setV] = useState(() => load(key, init));
  useEffect(() => save(key, v), [key, v]);
  return [v, setV];
}

export function AppProvider({ children }) {
  const [ready, setReady] = useState(!api.usingSupabase);
  const [user, setUser] = useState(null);
  const [selected, setSelected] = usePersist('selected', [16, 1, 4]); // 계란, 감자, 양파
  const [recent, setRecent] = usePersist('recent', [16, 1, 4, 19]);
  const [favorites, setFavorites] = usePersist('favorites', api.usingSupabase ? [] : [4, 3]);
  const [following, setFollowing] = usePersist('following', []);
  const [unread, setUnread] = useState(0);   // 안 읽은 알림 수 (UC-F05)
  const [isAdmin, setIsAdmin] = useState(!api.usingSupabase);
  const synced = useRef(null);
  const [fridge, setFridgeLocal] = usePersist('fridge', null); // 냉장고 모델 (설정 > 냉장고 모델, 로그인 시 계정 저장)
  const fridgeRef = useRef(fridge); fridgeRef.current = fridge;
  const setFridge = (model) => { setFridgeLocal(model); api.saveFridgeModel(model).catch(() => {}); };   // DB에 저장된 냉장고 재료 ID (동기화 전 null)
  const [toastMsg, setToastMsg] = useState('');
  const timer = useRef();
  const toast = (m) => { setToastMsg(m); clearTimeout(timer.current); timer.current = setTimeout(() => setToastMsg(''), 2200); };

  useEffect(() => {
    if (!api.usingSupabase) return;
    api.preload().catch((e) => toast(e.message)).finally(() => setReady(true));
    api.user.currentUser().then(setUser);
    return api.user.onAuthChange(setUser);
  }, []);
  useEffect(() => {
    if (!api.usingSupabase) return;
    if (user) {
      api.favoriteIds().then((ids) => ids && setFavorites(ids)).catch(() => {});
      api.recentIds().then((ids) => ids && setRecent(ids)).catch(() => {});
      // 내 냉장고: DB 재료와 이 기기 재료를 합침. 이 기기에만 있던 재료는 아래 효과에서 DB로 올라감
      api.fridgeIds().then((dbIds) => {
        if (!dbIds) return;
        synced.current = new Set(dbIds);
        setSelected((sel) => [...new Set([...dbIds, ...sel])]);
      }).catch(() => {});
      api.fridgeModel().then((m) => m !== undefined && (m ? setFridgeLocal(m) : fridgeRef.current && api.saveFridgeModel(fridgeRef.current))).catch(() => {});
    } else { setFavorites([]); synced.current = null; setUnread(0); setIsAdmin(false); }
    if (user) {
      api.isAdmin().then(setIsAdmin).catch(() => {});
      const poll = () => api.unreadCount().then(setUnread).catch(() => {});
      poll(); const h = setInterval(poll, 60000);
      return () => clearInterval(h);
    }
  }, [user]);

  // 재료 입력·삭제(담기, 빼기, 모두 지우기)가 일어나면 DB와 차이만 반영
  useEffect(() => {
    if (!user || !synced.current) return;
    const cur = new Set(selected), db = synced.current;
    const added = selected.filter((id) => !db.has(id)), removed = [...db].filter((id) => !cur.has(id));
    if (!added.length && !removed.length) return;
    synced.current = cur;
    api.addFridge(added).catch((e) => toast(e.message));
    api.removeFridge(removed).catch((e) => toast(e.message));
  }, [selected, user]);

  const needLogin = (what) => { if (api.usingSupabase && !user) { toast(`로그인하면 ${what}할 수 있어요`); return true; } return false; };
  const toggleSelected = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  // 최근 검색어 (UC-B03): 최신이 앞, 같은 재료는 하나만, 최대 8개
  const addRecent = (ids) => {
    setRecent((r) => [...ids, ...r.filter((x) => !ids.includes(x))].slice(0, 8));
    api.addRecent(ids).catch(() => {});
  };
  const removeRecent = (id) => {
    setRecent((r) => (id == null ? [] : r.filter((x) => x !== id)));
    api.removeRecent(id).catch(() => {});
  };

  const toggleFavorite = async (id) => {
    if (needLogin('찜')) return;
    const on = !favorites.includes(id);
    setFavorites((f) => (on ? [id, ...f] : f.filter((x) => x !== id)));
    try { await api.setFavorite(id, on); toast(on ? '찜 목록에 담았어요' : '찜 목록에서 뺐어요'); }
    catch (e) { setFavorites((f) => (on ? f.filter((x) => x !== id) : [id, ...f])); toast(e.message); }
  };
  const toggleFollow = async (name, writerId) => {
    if (needLogin('팔로우')) return;
    const key = writerId || name, on = !following.includes(key);
    setFollowing((f) => (on ? [...f, key] : f.filter((x) => x !== key)));
    try { await api.setFollow(writerId, on); if (on) toast(`${name}님을 팔로우했어요`); }
    catch (e) { setFollowing((f) => (on ? f.filter((x) => x !== key) : [...f, key])); toast(e.message); }
  };

  return (
    <Ctx.Provider value={{ ready, user, needLogin, selected, setSelected, toggleSelected, recent, setRecent, addRecent, removeRecent, favorites, toggleFavorite, following, toggleFollow, fridge, setFridge, unread, setUnread, isAdmin, toastMsg, toast }}>
      {children}
    </Ctx.Provider>
  );
}
export const useApp = () => useContext(Ctx);
