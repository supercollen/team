// 서버 없이 화면을 개발할 때 쓰는 가짜 API. 실제 서버도 같은 규칙으로 동작해야 합니다 (docs/API.md).
import { INGREDIENTS, RECIPES } from './mockData.js';

const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 120));
const byId = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i]));
const myRecipes = () => { try { return JSON.parse(localStorage.getItem('fridge_myRecipes') || '[]'); } catch { return []; } };
const allRecipes = () => [...myRecipes(), ...RECIPES];
// 체험 모드 후기·댓글 (이 기기에만 저장)
const ls = (k) => { try { return JSON.parse(localStorage.getItem('fridge_' + k) || '[]'); } catch { return []; } };
const lsSet = (k, v) => localStorage.setItem('fridge_' + k, JSON.stringify(v));
const avgOf = (r) => { const mine = ls('reviews').filter((x) => x.recipeId === r.id); if (!mine.length) return r.averageRating; const base = r.averageRating ? 12 : 0; return Math.round(((r.averageRating * base + mine.reduce((a, x) => a + x.rating, 0)) / (base + mine.length)) * 100) / 100; };

// 재료 검색: 표준명·별칭 모두 검색. 정렬 = 완전 일치 > 이름 앞부분 > 별칭 앞부분 > 포함
export function searchIngredientsSync(q, category) {
  const k = (q || '').trim().replace(/\s+/g, '');
  const pool = INGREDIENTS.filter((i) => !i.isSeasoning && (!category || category === '전체' || i.category === category));
  if (!k) return pool.map((i) => ({ ...i, matchedAlias: null }));
  const out = [];
  for (const i of pool) {
    let score = -1, alias = null;
    if (i.name === k) score = 0;
    else if (i.aliases.includes(k)) { score = 0; alias = k; }
    else if (i.name.startsWith(k)) score = 2;
    else { const a = i.aliases.find((x) => x.startsWith(k)); if (a) { score = 3; alias = a; } }
    if (score < 0 && i.name.includes(k)) score = 4;
    if (score < 0) { const a = i.aliases.find((x) => x.includes(k)); if (a) { score = 5; alias = a; } }
    if (score >= 0) out.push({ ...i, matchedAlias: alias, score });
  }
  return out.sort((a, b) => a.score - b.score || a.name.length - b.name.length);
}

// 추천: 일치율 = 일치한 주재료 ÷ 레시피 주재료 (양념 제외)
function recommendSync(ingredientIds, sort = 'rec') {
  const have = new Set(ingredientIds);
  const list = allRecipes().map((r) => {
    const main = r.ingredients.filter((x) => !byId[x.ingredientId]?.isSeasoning);
    const matched = main.filter((x) => have.has(x.ingredientId));
    const missing = main.filter((x) => !have.has(x.ingredientId)).map((x) => byId[x.ingredientId].name);
    return {
      recipeId: r.id, title: r.title, emoji: r.emoji, mainPhoto: r.mainPhoto || null, cookingTime: r.cookingTime,
      difficulty: r.difficulty, averageRating: avgOf(r),
      matchRate: main.length ? Math.round((matched.length / main.length) * 100) : 0, matchedCount: matched.length, missing,
    };
  }).filter((x) => x.matchedCount > 0);
  const cmp = {
    rec: (a, b) => b.matchRate - a.matchRate || b.matchedCount - a.matchedCount || b.averageRating - a.averageRating,
    time: (a, b) => a.cookingTime - b.cookingTime || b.matchRate - a.matchRate,
    rating: (a, b) => b.averageRating - a.averageRating,
  };
  return list.sort(cmp[sort] || cmp.rec);
}

function detail(r) {
  return {
    recipeId: r.id, title: r.title, intro: r.intro, tip: r.tip || null, category: r.category || null, emoji: r.emoji, mainPhoto: r.mainPhoto || null, cookingTime: r.cookingTime,
    difficulty: r.difficulty, servings: r.servings, views: r.views, saves: r.saves ?? 0, averageRating: avgOf(r), writer: r.writer, writerId: r.writer === '나' ? 'me' : undefined, isHidden: ls('hidden').includes(r.id), hiddenReason: ls('hidden').includes(r.id) ? '신고 접수로 숨김' : null,
    ingredients: r.ingredients.map((x) => ({ ...x, name: byId[x.ingredientId].name, emoji: byId[x.ingredientId].emoji, isSeasoning: byId[x.ingredientId].isSeasoning })),
    steps: r.steps,
  };
}

// 레시피 검색: 이름 일치 → 재료(별칭 포함) 일치 순, 같은 순위면 평점·조회수
function searchRecipesSync(q) {
  const k = q.trim().replace(/\s+/g, '');
  if (!k) return [];
  const ingIds = new Set(searchIngredientsSync(k).filter((i) => i.score <= 3).map((i) => i.id));
  const out = [];
  for (const r of allRecipes()) {
    const nameHit = r.title.replace(/\s+/g, '').includes(k);
    const hits = r.ingredients.filter((x) => ingIds.has(x.ingredientId)).map((x) => byId[x.ingredientId].name);
    if (!nameHit && !hits.length) continue;
    out.push({ ...card(r), rank: nameHit ? 0 : 1, matchReason: nameHit ? '이름 일치' : `재료 포함: ${hits.join(', ')}` });
  }
  return out.sort((a, b) => a.rank - b.rank || b.averageRating - a.averageRating || b.views - a.views);
}
function card(r) {
  return {
    recipeId: r.id, title: r.title, emoji: r.emoji, mainPhoto: r.mainPhoto || null, cookingTime: r.cookingTime,
    difficulty: r.difficulty, averageRating: avgOf(r), views: r.views, saves: r.saves ?? 0, writer: r.writer,
    ingredientNames: r.ingredients.filter((x) => !byId[x.ingredientId]?.isSeasoning).map((x) => byId[x.ingredientId].name),
  };
}

export const mock = {
  searchRecipes: (q) => wait(searchRecipesSync(q)),
  popularRecipes: () => wait(allRecipes().map(card).sort((a, b) => b.views - a.views).slice(0, 6)),
  ingredient: (id) => byId[id],
  searchIngredients: (q, category) => wait(searchIngredientsSync(q, category)),
  recommend: (ingredientIds, sort) => wait(recommendSync(ingredientIds, sort)),
  getRecipe: (id) => { const r = allRecipes().find((x) => String(x.id) === String(id)); return r ? wait(detail(r)) : Promise.reject(new Error('레시피를 찾을 수 없어요')); },
  getRecipes: (ids) => wait(ids.map((id) => allRecipes().find((x) => x.id === id)).filter(Boolean).map(detail)),
  myRecipes: () => wait(myRecipes().map(detail)),
  createRecipe: (body) => {
    const r = { id: Date.now(), writer: '나', views: 0, averageRating: 0, emoji: '🍽️', ...body };
    localStorage.setItem('fridge_myRecipes', JSON.stringify([r, ...myRecipes()]));
    return wait({ recipeId: r.id });
  },
  // 체험 모드 신고·관리자 (이 기기에만 저장)
  // 체험 모드: 업로더를 닉네임으로 구분
  followingList: () => {
    let keys = []; try { keys = JSON.parse(localStorage.getItem('fridge_following') || '[]'); } catch { /* 무시 */ }
    return wait(keys.map((k) => ({ key: k, writerId: null, nickname: k, recipes: allRecipes().filter((r) => r.writer === k).length })));
  },
  userPage: (key) => {
    const rs = allRecipes().filter((r) => r.writer === key);
    if (!rs.length) return Promise.reject(new Error('사용자를 찾을 수 없어요'));
    return wait({ key, writerId: null, nickname: key, followers: 0, recipes: rs.map((r) => ({ ...card(r), views: r.views, saves: r.saves ?? 0, writer: r.writer })) });
  },
  report: (targetType, targetId, reason) => {
    const all = ls('reports');
    if (all.some((x) => x.targetType === targetType && x.targetId === targetId && x.reporterId === 'me')) return Promise.reject(new Error('이미 신고한 게시물이에요'));
    lsSet('reports', [...all, { reportId: Date.now(), targetType, targetId: Number(targetId), reason, reporterId: 'me', reporter: '나', status: '대기', createdAt: new Date().toISOString() }]);
    return wait({ status: '대기' });
  },
  adminStats: () => {
    const rs = allRecipes(), hidden = ls('hidden');
    return wait({ users: 1, newUsers7d: 1, recipes: rs.length, hiddenRecipes: hidden.length, newRecipes7d: myRecipes().length, reviews: ls('reviews').length, comments: ls('comments').length,
      pendingReports: ls('reports').filter((x) => x.status === '대기').length, ingredients: INGREDIENTS.length,
      topRecipes: [...rs].sort((a, b) => b.views - a.views).slice(0, 5).map((r) => ({ recipeId: r.id, title: r.title, views: r.views, saves: r.saves ?? 0 })) });
  },
  adminReports: (status) => {
    const groups = {};
    for (const x of ls('reports').filter((x) => status === '전체' || x.status === status)) {
      const k = x.targetType + x.targetId; (groups[k] ||= { targetType: x.targetType, targetId: x.targetId, count: 0, reports: [], lastAt: x.createdAt }).reports.push(x);
      groups[k].count++; if (x.createdAt > groups[k].lastAt) groups[k].lastAt = x.createdAt;
    }
    const hidden = ls('hidden');
    return wait(Object.values(groups).map((g) => {
      if (g.targetType === 'RECIPE') { const r = allRecipes().find((v) => v.id === g.targetId); g.target = r && { title: r.title, writer: r.writer, isHidden: hidden.includes(r.id), recipeId: r.id, emoji: r.emoji }; }
      else { const c = ls('comments').find((v) => v.commentId === g.targetId); const r = c && allRecipes().find((v) => v.id === c.recipeId); g.target = c && { content: c.content, writer: c.writer, isHidden: !!c.isHidden, recipeId: c.recipeId, title: r?.title }; }
      return g;
    }).sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1)));
  },
  adminResolve: (type, id, action) => {
    if (type === 'RECIPE') {
      const h = ls('hidden').filter((x) => x !== id);
      if (action === 'hide') h.push(id);
      if (action === 'delete') localStorage.setItem('fridge_myRecipes', JSON.stringify(myRecipes().filter((r) => r.id !== id)));
      lsSet('hidden', h);
    } else {
      let cs = ls('comments');
      if (action === 'delete') cs = cs.filter((c) => c.commentId !== id && c.parentId !== id);
      else cs = cs.map((c) => (c.commentId === id ? { ...c, isHidden: action === 'hide' } : c));
      lsSet('comments', cs);
    }
    lsSet('reports', ls('reports').map((x) => (x.targetType === type && x.targetId === id && (x.status === '대기' || action === 'restore') ? { ...x, status: action === 'reject' ? '반려' : '처리 완료' } : x)));
    return wait(null);
  },
  adminRecipes: (q, filter) => {
    const hidden = ls('hidden');
    return wait(allRecipes().map((r) => ({ ...card(r), views: r.views, saves: r.saves ?? 0, writer: r.writer, isHidden: hidden.includes(r.id) }))
      .filter((r) => (!q.trim() || r.title.includes(q.trim())) && (filter !== 'hidden' || r.isHidden)));
  },
  notices: () => wait(ls('notices')),
  activeNotice: () => { const now = new Date().toISOString(); const n = ls('notices').find((x) => x.startsAt <= now && (!x.endsAt || x.endsAt > now)); return wait(n || null); },
  saveNotice: (n) => {
    if (!n.message.trim()) return Promise.reject(new Error('공지 내용을 입력해 주세요'));
    const all = ls('notices'), row = { ...n, message: n.message.trim(), startsAt: n.startsAt || new Date().toISOString(), endsAt: n.endsAt || null };
    lsSet('notices', n.id ? all.map((x) => (x.id === n.id ? { ...x, ...row } : x)) : [{ ...row, id: Date.now(), createdAt: new Date().toISOString() }, ...all]);
    return wait(null);
  },
  deleteNotice: (id) => { lsSet('notices', ls('notices').filter((x) => x.id !== id)); return wait(null); },
  adminUsers: () => wait([{ id: 'me', nickname: '체험 사용자', email: '(로그인 없음)', createdAt: new Date().toISOString(), recipes: myRecipes().length, reports: ls('reports').length, isAdmin: true }]),
  getRecipeForEdit: (id) => {
    const r = myRecipes().find((x) => String(x.id) === String(id));
    if (!r) return Promise.reject(new Error('내가 등록한 레시피만 수정할 수 있어요'));
    return wait({ recipeId: r.id, writerId: 'me', title: r.title, intro: r.intro || '', mainPhoto: r.mainPhoto || '', cookingTime: r.cookingTime, difficulty: r.difficulty, servings: r.servings,
      ingredients: r.ingredients.map(({ ingredientId, quantity, unit }) => ({ ingredientId, quantity, unit })),
      steps: r.steps.map((s) => ({ description: s.description, stepPhoto: s.stepPhoto, timerSeconds: s.timerSeconds })) });
  },
  updateRecipe: (id, body) => {
    const all = myRecipes(), k = all.findIndex((x) => String(x.id) === String(id));
    if (k < 0) return Promise.reject(new Error('내가 등록한 레시피만 수정할 수 있어요'));
    all[k] = { ...all[k], ...body, steps: body.steps.map((s, i) => ({ ...s, stepNumber: i + 1 })) };
    localStorage.setItem('fridge_myRecipes', JSON.stringify(all)); return wait(null);
  },
  adminIngredients: () => {
    const used = (id) => allRecipes().filter((r) => r.ingredients.some((x) => x.ingredientId === id)).length;
    return wait(INGREDIENTS.map((i) => ({ id: i.id, name: i.name, category: i.category, emoji: i.emoji || '', isSeasoning: !!i.isSeasoning, substituteInfo: i.substituteInfo || '', aliases: i.aliases || [], usedIn: used(i.id) })));
  },
  saveIngredient: (x) => {
    const name = x.name.trim();
    if (!name) return Promise.reject(new Error('재료 이름을 입력해 주세요'));
    if (INGREDIENTS.some((i) => i.name === name && i.id !== x.id)) return Promise.reject(new Error('같은 이름의 재료가 이미 있어요'));
    const row = { name, category: x.category, emoji: x.emoji || '', isSeasoning: !!x.isSeasoning, substituteInfo: x.substituteInfo || '', aliases: x.aliases.map((a) => a.trim()).filter(Boolean) };
    if (x.id) Object.assign(byId[x.id], row);
    else { const id = Math.max(...INGREDIENTS.map((i) => i.id)) + 1; const n = { id, ...row }; INGREDIENTS.push(n); byId[id] = n; }
    return wait(null);
  },
  deleteIngredient: (id) => {
    if (allRecipes().some((r) => r.ingredients.some((x) => x.ingredientId === id))) return Promise.reject(new Error('레시피에 쓰이는 재료라 삭제할 수 없어요. 레시피에서 먼저 빼 주세요'));
    INGREDIENTS.splice(INGREDIENTS.findIndex((i) => i.id === id), 1); delete byId[id]; return wait(null);
  },
  deleteRecipe: (id) => { localStorage.setItem('fridge_myRecipes', JSON.stringify(myRecipes().filter((r) => r.id !== id))); return wait(null); },
  reviews: (recipeId) => wait(ls('reviews').filter((x) => x.recipeId === Number(recipeId))),
  saveReview: (recipeId, { reviewId, rating, content, photo }) => {
    const all = ls('reviews');
    if (reviewId) { const x = all.find((v) => v.reviewId === reviewId); if (x) Object.assign(x, { rating, content, photo }); }
    else all.unshift({ reviewId: Date.now(), recipeId: Number(recipeId), rating, content, photo, createdAt: new Date().toISOString(), writerId: 'me', writer: '나' });
    lsSet('reviews', all); return wait(null);
  },
  deleteReview: (id) => { lsSet('reviews', ls('reviews').filter((x) => x.reviewId !== id)); return wait(null); },
  recipeRating: (recipeId) => { const r = allRecipes().find((x) => x.id === Number(recipeId)); return wait(r ? avgOf(r) : 0); },
  comments: (recipeId) => wait(ls('comments').filter((x) => x.recipeId === Number(recipeId))),
  addComment: (recipeId, content, parentId = null) => {
    if (!content.trim()) return Promise.reject(new Error('내용을 입력해 주세요'));
    lsSet('comments', [...ls('comments'), { commentId: Date.now(), recipeId: Number(recipeId), parentId, content: content.trim(), createdAt: new Date().toISOString(), writerId: 'me', writer: '나' }]);
    return wait(null);
  },
  deleteComment: (id) => { lsSet('comments', ls('comments').filter((x) => x.commentId !== id && x.parentId !== id)); return wait(null); },
};
