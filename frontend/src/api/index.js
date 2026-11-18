// 화면은 이 파일의 api 객체만 호출합니다.
// 구조는 클래스 다이어그램의 서비스와 같게 나눴습니다:
//   IngredientService · RecipeService · InteractionService · ReportService · UserService
// Supabase 설정(.env)이 없으면 mock 데이터로 동작합니다.
import { supabase, USE_SUPABASE } from '../lib/supabase.js';
import { mock } from './mock.js';
import { INGREDIENTS } from './mockData.js';

const sb = supabase;
const must = ({ data, error }) => { if (error) throw new Error(friendly(error)); return data; };
function friendly(e) {
  if (e.code === '23505') return '이미 처리된 요청이에요';
  if (e.code === '42501' || /row-level security/.test(e.message)) return '권한이 없어요. 로그인했는지 확인해 주세요';
  return e.message || '요청에 실패했어요';
}
const toCard = (r) => ({
  recipeId: r.recipe_id, title: r.title, emoji: r.emoji, mainPhoto: r.main_photo, cookingTime: r.cooking_time,
  difficulty: r.difficulty, averageRating: Number(r.average_rating), writer: r.profiles?.nickname,
  views: r.views, saves: r.saves, createdAt: r.created_at, isHidden: !!r.is_hidden,
});

// 재료 이름·이모지 표시용 캐시 (앱 시작 때 한 번 불러옴)
let ingredientCache = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i]));

/* ---------------- IngredientService ---------------- */
const IngredientService = {
  async preload() {
    if (!USE_SUPABASE) { ingredientCache = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i])); return; }
    const rows = must(await sb.from('ingredient').select('ingredient_id, name, category, emoji, is_seasoning, substitute_info'));
    ingredientCache = Object.fromEntries(rows.map((r) => [r.ingredient_id, { id: r.ingredient_id, name: r.name, category: r.category, emoji: r.emoji, isSeasoning: r.is_seasoning, substituteInfo: r.substitute_info }]));
  },
  ingredient: (id) => ingredientCache[id] || { id, name: '알 수 없는 재료', emoji: '❔' },
  async searchIngredients(q, category) {
    if (!USE_SUPABASE) return mock.searchIngredients(q, category);
    const rows = must(await sb.rpc('search_ingredients', { q: q || '', cat: category || '' }));
    return rows.map((r) => ({ id: r.id, name: r.name, category: r.category, emoji: r.emoji, matchedAlias: r.matched_alias }));
  },
};

/* ---------------- RecipeService ---------------- */
const RecipeService = {
  async recommend(ingredientIds, sort = 'rec') {
    if (!USE_SUPABASE) return mock.recommend(ingredientIds, sort);
    const rows = must(await sb.rpc('recommend_recipes', { ingredient_ids: ingredientIds, sort }));
    return rows.map((r) => ({ ...toCard(r), matchRate: r.match_rate, matchedCount: r.matched_count, missing: r.missing }));
  },
  // 레시피 검색: 이름 일치 + 재료(별칭 포함) 일치
  async searchRecipes(q) {
    if (!USE_SUPABASE) return mock.searchRecipes(q);
    const k = q.trim();
    const sel = 'recipe_id, title, emoji, main_photo, cooking_time, difficulty, average_rating, views, profiles(nickname), recipe_ingredient(ingredient_id, ingredient(name, is_seasoning))';
    // 재료는 이름·별칭이 검색어로 시작하는 것만 (예: '파' → 대파 O, 양파 X)
    const kk = k.replace(/\s+/g, '');
    const ings = (await IngredientService.searchIngredients(kk, '')).filter((i) => i.name.startsWith(kk) || i.matchedAlias?.startsWith(kk)).slice(0, 5);
    const ingIds = ings.map((i) => i.id);
    const [byName, byIngRows] = await Promise.all([
      sb.from('recipe').select(sel).ilike('title', `%${k.replace(/[%_]/g, '')}%`).limit(30).then(must),
      ingIds.length ? sb.from('recipe_ingredient').select('recipe_id').in('ingredient_id', ingIds).limit(200).then(must) : [],
    ]);
    const nameIds = new Set(byName.map((r) => r.recipe_id));
    const extraIds = [...new Set(byIngRows.map((r) => r.recipe_id))].filter((id) => !nameIds.has(id));
    const byIng = extraIds.length ? must(await sb.from('recipe').select(sel).in('recipe_id', extraIds)) : [];
    const names = Object.fromEntries(ings.map((i) => [i.id, i.name]));
    const toResult = (r, nameHit) => ({
      ...toCard(r), views: r.views,
      ingredientNames: r.recipe_ingredient.filter((x) => !x.ingredient.is_seasoning).map((x) => x.ingredient.name),
      matchReason: nameHit ? '이름 일치' : `재료 포함: ${r.recipe_ingredient.filter((x) => names[x.ingredient_id]).map((x) => x.ingredient.name).join(', ')}`,
      rank: nameHit ? 0 : 1,
    });
    return [...byName.map((r) => toResult(r, true)), ...byIng.map((r) => toResult(r, false))]
      .sort((a, b) => a.rank - b.rank || b.averageRating - a.averageRating || b.views - a.views);
  },
  async popularRecipes() {
    if (!USE_SUPABASE) return mock.popularRecipes();
    const rows = must(await sb.from('recipe')
      .select('recipe_id, title, emoji, main_photo, cooking_time, difficulty, average_rating, views, profiles(nickname), recipe_ingredient(ingredient_id, ingredient(name, is_seasoning))')
      .order('views', { ascending: false }).limit(6));
    return rows.map((r) => ({ ...toCard(r), ingredientNames: r.recipe_ingredient.filter((x) => !x.ingredient.is_seasoning).map((x) => x.ingredient.name) }));
  },
  async getRecipe(id) {
    if (!USE_SUPABASE) return mock.getRecipe(id);
    return must(await sb.rpc('get_recipe', { p_recipe_id: Number(id) }));
  },
  async getRecipes(ids) {
    if (!USE_SUPABASE) return mock.getRecipes(ids);
    if (!ids.length) return [];
    const rows = must(await sb.from('recipe').select('*, profiles(nickname)').in('recipe_id', ids));
    return ids.map((id) => rows.find((r) => r.recipe_id === id)).filter(Boolean).map(toCard);
  },
  async myRecipes() {
    if (!USE_SUPABASE) return mock.myRecipes();
    const user = await UserService.currentUser();
    if (!user) return [];
    const rows = must(await sb.from('recipe').select('*, profiles(nickname)').eq('writer_id', user.id).order('created_at', { ascending: false }));
    return rows.map(toCard);
  },
  async uploadPhoto(dataUrl) {
    const user = await UserService.currentUser();
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${user.id}/${Date.now()}.${(blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`;
    must(await sb.storage.from('recipe-photos').upload(path, blob, { contentType: blob.type }));
    return sb.storage.from('recipe-photos').getPublicUrl(path).data.publicUrl;
  },
  async createRecipe(body) {
    if (!USE_SUPABASE) return mock.createRecipe(body);
    const payload = await RecipeService.uploadAll(body);
    const recipeId = must(await sb.rpc('create_recipe', { payload }));
    // 단계 사진 주소 저장 (06 SQL 실행 전 등록 함수도 지원)
    for (const s of payload.steps.filter((x) => x.stepPhoto)) {
      must(await sb.from('recipe_step').update({ step_photo: s.stepPhoto }).eq('recipe_id', recipeId).eq('step_number', s.stepNumber));
    }
    return { recipeId };
  },
  // 대표·단계 사진 중 새로 고른 것(data:)만 저장소에 올리고 주소로 바꿈
  async uploadAll(body) {
    const up = (v) => (v?.startsWith('data:') ? RecipeService.uploadPhoto(v) : v || null);
    return { ...body, mainPhoto: await up(body.mainPhoto), steps: await Promise.all(body.steps.map(async (s) => ({ ...s, stepPhoto: await up(s.stepPhoto) }))) };
  },
  // UC-E02 수정용으로 내 레시피 불러오기 (조회수 증가 없음)
  async getRecipeForEdit(id) {
    if (!USE_SUPABASE) return mock.getRecipeForEdit(id);
    const r = must(await sb.from('recipe').select('*, recipe_ingredient(ingredient_id, quantity, unit), recipe_step(step_number, description, step_photo, timer_seconds)').eq('recipe_id', id).single());
    return {
      recipeId: r.recipe_id, writerId: r.writer_id, title: r.title, intro: r.intro || '', mainPhoto: r.main_photo || '', cookingTime: r.cooking_time, difficulty: r.difficulty, servings: r.servings,
      ingredients: r.recipe_ingredient.map((x) => ({ ingredientId: x.ingredient_id, quantity: x.quantity == null ? null : Number(x.quantity), unit: x.unit })),
      steps: r.recipe_step.sort((a, b) => a.step_number - b.step_number).map((s) => ({ description: s.description, stepPhoto: s.step_photo, timerSeconds: s.timer_seconds })),
    };
  },
  async updateRecipe(id, body) {
    if (!USE_SUPABASE) return mock.updateRecipe(id, body);
    const payload = await RecipeService.uploadAll(body);
    const { error } = await sb.rpc('update_recipe', { p_recipe_id: Number(id), payload });
    if (error?.code === 'PGRST202') throw new Error('레시피 수정 기능은 Supabase에 06 SQL을 실행한 뒤 사용할 수 있어요');
    if (error) throw new Error(friendly(error));
  },
  // UC-E02 내 레시피 삭제 (단계·재료·찜·후기·댓글은 DB에서 함께 삭제)
  async deleteRecipe(recipeId, mainPhoto) {
    if (!USE_SUPABASE) return mock.deleteRecipe(recipeId);
    const rows = must(await sb.from('recipe').delete().eq('recipe_id', recipeId).select('recipe_id'));
    if (!rows.length) throw new Error('내가 등록한 레시피만 삭제할 수 있어요');
    const m = mainPhoto?.match(/recipe-photos\/(.+)$/);
    if (m) await sb.storage.from('recipe-photos').remove([decodeURIComponent(m[1])]);
  },
};

/* ---------------- ReviewService (UC-F01 평점·후기) ---------------- */
const ReviewService = {
  async reviews(recipeId) {
    if (!USE_SUPABASE) return mock.reviews(recipeId);
    const rows = must(await sb.from('review').select('review_id, rating, content, photo, created_at, writer_id, profiles(nickname)')
      .eq('recipe_id', recipeId).order('created_at', { ascending: false }));
    return rows.map((r) => ({ reviewId: r.review_id, rating: Number(r.rating), content: r.content, photo: r.photo, createdAt: r.created_at, writerId: r.writer_id, writer: r.profiles?.nickname || '알 수 없음' }));
  },
  async saveReview(recipeId, { reviewId, rating, content, photo }) {
    if (!USE_SUPABASE) return mock.saveReview(recipeId, { reviewId, rating, content, photo });
    const user = await UserService.currentUser();
    if (!user) throw new Error('로그인이 필요해요');
    const url = photo?.startsWith('data:') ? await RecipeService.uploadPhoto(photo) : photo || null;
    const body = { rating, content: content?.trim() || null, photo: url };
    if (reviewId) must(await sb.from('review').update(body).eq('review_id', reviewId));
    else must(await sb.from('review').insert({ ...body, recipe_id: recipeId, writer_id: user.id }));
  },
  async deleteReview(reviewId) {
    if (!USE_SUPABASE) return mock.deleteReview(reviewId);
    must(await sb.from('review').delete().eq('review_id', reviewId));
  },
  async recipeRating(recipeId) {
    if (!USE_SUPABASE) return mock.recipeRating(recipeId);
    return Number(must(await sb.from('recipe').select('average_rating').eq('recipe_id', recipeId).single()).average_rating);
  },
};

/* ---------------- CommentService (UC-F02 질문 댓글 · 업로더 답변) ---------------- */
const CommentService = {
  async comments(recipeId) {
    if (!USE_SUPABASE) return mock.comments(recipeId);
    const rows = must(await sb.from('comment').select('*, profiles(nickname)')
      .eq('recipe_id', recipeId).order('reg_date'));
    return rows.map((c) => ({ commentId: c.comment_id, parentId: c.parent_comment_id, content: c.content, createdAt: c.reg_date, writerId: c.writer_id, writer: c.profiles?.nickname || '알 수 없음', isHidden: !!c.is_hidden }));
  },
  async addComment(recipeId, content, parentId = null) {
    if (!USE_SUPABASE) return mock.addComment(recipeId, content, parentId);
    const user = await UserService.currentUser();
    if (!user) throw new Error('로그인이 필요해요');
    const text = content.trim();
    if (!text) throw new Error('내용을 입력해 주세요');
    must(await sb.from('comment').insert({ recipe_id: recipeId, writer_id: user.id, content: text, parent_comment_id: parentId }));
  },
  async deleteComment(commentId) {
    if (!USE_SUPABASE) return mock.deleteComment(commentId);
    must(await sb.from('comment').delete().eq('comment_id', commentId));
  },
};

/* ---------------- InteractionService (찜 · 팔로우) ---------------- */
const InteractionService = {
  async favoriteIds() {
    const user = await UserService.currentUser();
    if (!USE_SUPABASE || !user) return null;
    return must(await sb.from('favorite').select('recipe_id').order('created_at', { ascending: false })).map((r) => r.recipe_id);
  },
  async setFavorite(recipeId, on) {
    if (!USE_SUPABASE) return;
    const user = await UserService.currentUser();
    if (!user) throw new Error('로그인하면 찜할 수 있어요');
    if (on) must(await sb.from('favorite').insert({ user_id: user.id, recipe_id: recipeId }));
    else must(await sb.from('favorite').delete().eq('user_id', user.id).eq('recipe_id', recipeId));
  },
  // 팔로잉 목록·업로더 페이지 (UC-F03)
  async followingIds() {
    if (!USE_SUPABASE) return null;
    const user = await UserService.currentUser();
    if (!user) return null;
    return must(await sb.from('follow').select('following_id').eq('follower_id', user.id)).map((r) => r.following_id);
  },
  async followingList() {
    if (!USE_SUPABASE) return mock.followingList();
    const user = await UserService.currentUser();
    if (!user) return [];
    const rows = must(await sb.from('follow').select('following_id, profiles!follow_following_id_fkey(id, nickname)').eq('follower_id', user.id).order('follow_id', { ascending: false }));
    const ids = rows.map((r) => r.following_id);
    const recs = ids.length ? must(await sb.from('recipe').select('writer_id').in('writer_id', ids)) : [];
    return rows.map((r) => ({ key: r.following_id, writerId: r.following_id, nickname: r.profiles?.nickname || '알 수 없음', recipes: recs.filter((x) => x.writer_id === r.following_id).length }));
  },
  async userPage(key) {
    if (!USE_SUPABASE) return mock.userPage(key);
    const p = must(await sb.from('profiles').select('id, nickname').eq('id', key).maybeSingle());
    if (!p) throw new Error('사용자를 찾을 수 없어요');
    const recipes = must(await sb.from('recipe').select('*, profiles(nickname)').eq('writer_id', key).order('created_at', { ascending: false })).map(toCard);
    const { count } = await sb.from('follow').select('follow_id', { count: 'exact', head: true }).eq('following_id', key);
    return { key: p.id, writerId: p.id, nickname: p.nickname, recipes, followers: count || 0 };
  },
  async setFollow(writerId, on) {
    if (!USE_SUPABASE || !writerId) return;
    const user = await UserService.currentUser();
    if (!user) throw new Error('로그인하면 팔로우할 수 있어요');
    if (on) must(await sb.from('follow').insert({ follower_id: user.id, following_id: writerId }));
    else must(await sb.from('follow').delete().eq('follower_id', user.id).eq('following_id', writerId));
  },
};

/* ---------------- ReportService ---------------- */
const ReportService = {
  async report(targetType, targetId, reason) {
    if (!USE_SUPABASE) return mock.report(targetType, targetId, reason);
    const user = await UserService.currentUser();
    if (!user) throw new Error('로그인하면 신고할 수 있어요');
    const { error } = await sb.from('report').insert({ reporter_id: user.id, target_type: targetType, target_id: targetId, reason });
    if (error?.code === '23505') throw new Error('이미 신고한 게시물이에요');
    if (error) throw new Error(friendly(error));
    return { status: '대기' };
  },
};

/* ---------------- RecentSearchService (UC-B03 최근 검색어) ---------------- */
// 로그인 상태면 recent_search 테이블에 재료 ID로 저장, 아니면 이 기기에만 저장(store.jsx)
const RECENT_MAX = 8;
const RecentSearchService = {
  async recentIds() {
    const user = await UserService.currentUser();
    if (!USE_SUPABASE || !user) return null;
    const rows = must(await sb.from('recent_search').select('ingredient_id').order('searched_at', { ascending: false }).limit(40));
    return [...new Set(rows.map((r) => r.ingredient_id))].slice(0, RECENT_MAX);
  },
  async addRecent(ids) {
    const user = await UserService.currentUser();
    if (!USE_SUPABASE || !user || !ids.length) return;
    must(await sb.from('recent_search').delete().eq('user_id', user.id).in('ingredient_id', ids));   // 같은 재료는 최신 1개만
    must(await sb.from('recent_search').insert(ids.map((id) => ({ user_id: user.id, ingredient_id: id }))));
  },
  async removeRecent(id) {
    const user = await UserService.currentUser();
    if (!USE_SUPABASE || !user) return;
    let q = sb.from('recent_search').delete().eq('user_id', user.id);
    if (id != null) q = q.eq('ingredient_id', id);   // id 없으면 전체 삭제
    must(await q);
  },
};

/* ---------------- UserService (Supabase Auth) ---------------- */
const UserService = {
  async currentUser() {
    if (!USE_SUPABASE) return null;
    return (await sb.auth.getSession()).data.session?.user ?? null;
  },
  async profile() {
    const user = await UserService.currentUser();
    if (!user) return null;
    return must(await sb.from('profiles').select('id, nickname, email').eq('id', user.id).single());
  },
  onAuthChange(cb) {
    if (!USE_SUPABASE) return () => {};
    const { data } = sb.auth.onAuthStateChange((_e, session) => cb(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  },
  async signUp({ email, password, nickname }) {
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { nickname } } });
    if (error) throw new Error(/registered/.test(error.message) ? '이미 가입된 이메일이에요' : error.message);
    return data;
  },
  async signIn({ email, password }) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error('이메일 또는 비밀번호가 맞지 않아요');
  },
  async signOut() { await sb.auth.signOut(); },
  // 계정 설정
  async updateNickname(nickname) {
    const n = nickname.trim();
    if (n.length < 2 || n.length > 12) throw new Error('닉네임은 2~12자로 정해 주세요');
    const user = await UserService.currentUser();
    if (!user) throw new Error('로그인이 필요해요');
    const { error } = await sb.from('profiles').update({ nickname: n }).eq('id', user.id);
    if (error?.code === '23505') throw new Error('이미 사용 중인 닉네임이에요');
    if (error) throw new Error(friendly(error));
    return n;
  },
  async changePassword(current, next) {
    if (next.length < 6) throw new Error('새 비밀번호는 6자 이상이어야 해요');
    const user = await UserService.currentUser();
    if (!user) throw new Error('로그인이 필요해요');
    const { error: e1 } = await sb.auth.signInWithPassword({ email: user.email, password: current });
    if (e1) throw new Error('현재 비밀번호가 맞지 않아요');
    const { error } = await sb.auth.updateUser({ password: next });
    if (error) throw new Error(/different/.test(error.message) ? '지금과 다른 비밀번호를 입력해 주세요' : error.message);
  },
  async deleteAccount() {
    must(await sb.rpc('delete_my_account'));
    await sb.auth.signOut();
  },
};

/* ---------------- FridgeService (내 냉장고 재료, fridge_item) — UC-B01·B02 DB 연동 ---------------- */
const FridgeService = {
  async fridgeIds() {
    const user = await UserService.currentUser();
    if (!USE_SUPABASE || !user) return null;
    const rows = must(await sb.from('fridge_item').select('ingredient_id').eq('user_id', user.id).order('saved_at'));
    return rows.map((r) => r.ingredient_id);
  },
  async addFridge(ids) {
    const user = await UserService.currentUser();
    if (!USE_SUPABASE || !user || !ids.length) return;
    must(await sb.from('fridge_item').upsert(ids.map((id) => ({ user_id: user.id, ingredient_id: id })), { onConflict: 'user_id,ingredient_id', ignoreDuplicates: true }));
  },
  async removeFridge(ids) {
    const user = await UserService.currentUser();
    if (!USE_SUPABASE || !user || !ids.length) return;
    must(await sb.from('fridge_item').delete().eq('user_id', user.id).in('ingredient_id', ids));
  },
};

/* ---------------- NotificationService (UC-F05 레시피 알림) ---------------- */
const NotificationService = {
  async notifications() {
    const user = await UserService.currentUser();
    if (!USE_SUPABASE || !user) return [];
    const { data, error } = await sb.from('notification').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (error) return [];
    return data.map((n) => ({ id: n.notification_id, type: n.type, relatedType: n.related_type, relatedId: n.related_id, message: n.message, isRead: n.is_read, createdAt: n.created_at }));
  },
  async unreadCount() {
    const user = await UserService.currentUser();
    if (!USE_SUPABASE || !user) return 0;
    const { count } = await sb.from('notification').select('notification_id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false);
    return count || 0;
  },
  async markAllRead() {
    const user = await UserService.currentUser();
    if (!USE_SUPABASE || !user) return;
    await sb.from('notification').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
  },
  async deleteNotification(id) {
    if (!USE_SUPABASE) return;
    must(await sb.from('notification').delete().eq('notification_id', id));
  },
};

/* ---------------- AdminService (UC-G02 관리자 재료 DB 관리) ---------------- */
const AdminService = {
  async isAdmin() {
    if (!USE_SUPABASE) return true;   // 체험 모드는 관리자 화면 미리보기 허용
    const user = await UserService.currentUser();
    if (!user) return false;
    const { data, error } = await sb.rpc('is_admin');
    return !error && data === true;
  },
  async adminIngredients() {
    if (!USE_SUPABASE) return mock.adminIngredients();
    const rows = must(await sb.from('ingredient').select('ingredient_id, name, category, emoji, is_seasoning, substitute_info, ingredient_alias(alias_name), recipe_ingredient(count)').order('category').order('name'));
    return rows.map((r) => ({ id: r.ingredient_id, name: r.name, category: r.category, emoji: r.emoji || '', isSeasoning: r.is_seasoning, substituteInfo: r.substitute_info || '', aliases: r.ingredient_alias.map((a) => a.alias_name), usedIn: r.recipe_ingredient[0]?.count || 0 }));
  },
  async saveIngredient(x) {
    if (!USE_SUPABASE) { await mock.saveIngredient(x); return IngredientService.preload(); }
    const name = x.name.trim();
    if (!name) throw new Error('재료 이름을 입력해 주세요');
    const row = { name, category: x.category, emoji: x.emoji?.trim() || null, is_seasoning: !!x.isSeasoning, substitute_info: x.substituteInfo?.trim() || null };
    let id = x.id;
    const res = id ? await sb.from('ingredient').update(row).eq('ingredient_id', id).select('ingredient_id') : await sb.from('ingredient').insert(row).select('ingredient_id');
    if (res.error?.code === '23505') throw new Error('같은 이름의 재료가 이미 있어요');
    const saved = must(res);
    if (!saved.length) throw new Error('관리자만 재료를 수정할 수 있어요');
    id = saved[0].ingredient_id;
    const aliases = [...new Set(x.aliases.map((a) => a.trim()).filter((a) => a && a !== name))];
    must(await sb.from('ingredient_alias').delete().eq('ingredient_id', id));
    if (aliases.length) {
      const r2 = await sb.from('ingredient_alias').insert(aliases.map((a) => ({ alias_name: a, ingredient_id: id })));
      if (r2.error?.code === '23505') throw new Error('다른 재료가 이미 쓰고 있는 별칭이 있어요');
      must(r2);
    }
    await IngredientService.preload();
    return id;
  },
  async deleteIngredient(id) {
    if (!USE_SUPABASE) { await mock.deleteIngredient(id); return IngredientService.preload(); }
    const res = await sb.from('ingredient').delete().eq('ingredient_id', id).select('ingredient_id');
    if (res.error?.code === '23503') throw new Error('레시피에 쓰이는 재료라 삭제할 수 없어요. 레시피에서 먼저 빼 주세요');
    if (!must(res).length) throw new Error('관리자만 재료를 삭제할 수 있어요');
    await IngredientService.preload();
  },
};

/* ---------------- AdminService 2 (UC-G01 신고·레시피·댓글, 공지, 회원) ---------------- */
const need07 = (e) => { if (e?.code === 'PGRST202' || e?.code === '42883' || e?.code === '42P01') throw new Error('관리자 기능은 Supabase에 07 SQL을 실행한 뒤 사용할 수 있어요'); if (e) throw new Error(friendly(e)); };
const rpc07 = async (fn, args) => { const { data, error } = await sb.rpc(fn, args); need07(error); return data; };
const AdminService2 = {
  async adminStats() { return USE_SUPABASE ? rpc07('admin_stats') : mock.adminStats(); },
  async adminReports(status = '대기') { return USE_SUPABASE ? rpc07('admin_reports', { p_status: status }) : mock.adminReports(status); },
  async adminResolve(targetType, targetId, action, reason) {
    if (!USE_SUPABASE) return mock.adminResolve(targetType, targetId, action, reason);
    return rpc07('admin_resolve', { p_target_type: targetType, p_target_id: targetId, p_action: action, p_reason: reason || null });
  },
  async adminRecipes(q = '', filter = 'all') {
    if (!USE_SUPABASE) return mock.adminRecipes(q, filter);
    let qb = sb.from('recipe').select('recipe_id, title, emoji, main_photo, cooking_time, difficulty, average_rating, views, saves, created_at, is_hidden, writer_id, profiles(nickname)').order('created_at', { ascending: false }).limit(100);
    if (q.trim()) qb = qb.ilike('title', `%${q.trim()}%`);
    if (filter === 'hidden') qb = qb.eq('is_hidden', true);
    const { data, error } = await qb; need07(error);
    return data.map(toCard);
  },
  async adminDeleteComment(id) {
    if (!USE_SUPABASE) return mock.deleteComment(id);
    must(await sb.from('comment').delete().eq('comment_id', id));
  },
  async adminDeleteReview(id) {
    if (!USE_SUPABASE) return mock.deleteReview(id);
    must(await sb.from('review').delete().eq('review_id', id));
  },
  // 공지 (UC-N06)
  async notices() {
    if (!USE_SUPABASE) return mock.notices();
    const { data, error } = await sb.from('notice').select('*').order('created_at', { ascending: false }).limit(30); need07(error);
    return data.map((n) => ({ id: n.notice_id, message: n.message, level: n.level, startsAt: n.starts_at, endsAt: n.ends_at, createdAt: n.created_at }));
  },
  async activeNotice() {
    if (!USE_SUPABASE) return mock.activeNotice();
    const now = new Date().toISOString();
    const { data, error } = await sb.from('notice').select('*').lte('starts_at', now).or(`ends_at.is.null,ends_at.gt.${now}`).order('created_at', { ascending: false }).limit(1);
    if (error || !data?.length) return null;
    return { message: data[0].message, level: data[0].level, id: data[0].notice_id };
  },
  async saveNotice(n) {
    if (!USE_SUPABASE) return mock.saveNotice(n);
    const user = await UserService.currentUser();
    const row = { message: n.message.trim(), level: n.level, starts_at: n.startsAt || new Date().toISOString(), ends_at: n.endsAt || null };
    if (!row.message) throw new Error('공지 내용을 입력해 주세요');
    const { error } = n.id ? await sb.from('notice').update(row).eq('notice_id', n.id) : await sb.from('notice').insert({ ...row, created_by: user?.id });
    need07(error);
  },
  async deleteNotice(id) {
    if (!USE_SUPABASE) return mock.deleteNotice(id);
    const { error } = await sb.from('notice').delete().eq('notice_id', id); need07(error);
  },
  // 회원
  async adminUsers(q = '') { return USE_SUPABASE ? rpc07('admin_users', { q }) : mock.adminUsers(q); },
  async adminSetAdmin(userId, on) { return USE_SUPABASE ? rpc07('admin_set_admin', { p_user: userId, p_on: on }) : Promise.reject(new Error('체험 모드에서는 관리자 지정을 할 수 없어요')); },
};

/* ---------------- PreferenceService (설정 > 내 냉장고) ---------------- */
const PreferenceService = {
  async fridgeModel() {
    const user = await UserService.currentUser();
    if (!USE_SUPABASE || !user) return undefined;
    const { data, error } = await sb.from('user_preference').select('fridge_model').eq('user_id', user.id).maybeSingle();
    if (error) return undefined;   // 05 SQL 실행 전이면 이 기기 값만 사용
    return data?.fridge_model ?? null;
  },
  async saveFridgeModel(model) {
    const user = await UserService.currentUser();
    if (!USE_SUPABASE || !user) return;
    await sb.from('user_preference').upsert({ user_id: user.id, fridge_model: model, updated_at: new Date().toISOString() });
  },
};

export const api = {
  ...IngredientService, ...RecipeService, ...InteractionService, ...ReportService, ...RecentSearchService, ...PreferenceService, ...FridgeService, ...ReviewService, ...CommentService, ...NotificationService, ...AdminService, ...AdminService2,
  user: UserService, usingSupabase: USE_SUPABASE,
};
