// 회귀·시나리오·예외 처리 자동 테스트 (7.2)
// 실행: npm run test:regression   (빌드 → 미리보기 서버 → 체험 모드에서 시나리오 실행 → tests/regression-result.md 저장)
// 다른 주소를 테스트하려면: BASE_URL=https://fridgy-68a.pages.dev node tests/regression.mjs   (실서버는 로그인 화면이 달라 일부 시나리오가 실패할 수 있음)
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
// playwright 는 개발 PC에만 필요(배포 빌드에는 넣지 않음): npm i -D playwright && npx playwright install chromium
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const DEVICE = process.env.DEVICE || 'Galaxy S24';
const results = [];

async function startPreview() {
  if (process.env.BASE_URL) return null;
  const p = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' } });
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(BASE); if (r.ok) return p; } catch { /* 기다림 */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('미리보기 서버가 뜨지 않았어요');
}

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

async function run() {
  const server = await startPreview();
  const browser = await chromium.launch();
  const newPage = async (init) => {
    const ctx = await browser.newContext({ ...devices[DEVICE] });
    if (init) await ctx.addInitScript(init);
    const page = await ctx.newPage();
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(e.message));
    return { ctx, page };
  };
  const toastText = async (page) => (await page.locator('.toast').textContent({ timeout: 3000 }).catch(() => '')) || '';

  async function test(id, area, name, fn) {
    const t0 = Date.now();
    const { ctx, page } = await newPage(() => { if (!sessionStorage.getItem('__init')) { localStorage.clear(); localStorage.setItem('fridge_selected', '[]'); sessionStorage.setItem('__init', '1'); } });
    try {
      await fn(page, ctx);
      assert(!page.errors.length, '스크립트 오류: ' + page.errors[0]);
      results.push({ id, area, name, ok: true, ms: Date.now() - t0 });
    } catch (e) {
      results.push({ id, area, name, ok: false, ms: Date.now() - t0, err: e.message.split('\n')[0] });
    } finally { await ctx.close(); }
  }
  const go = (page, path) => page.goto(BASE + path, { waitUntil: 'networkidle' });

  // ───────── 시나리오 (회귀) ─────────
  await test('S01', '재료·추천', '재료 3개 담기 → 요리 추천 → 일치율 표시 (UC-B01·C01·C02)', async (p) => {
    await go(p, '/fridge');
    for (const n of ['감자', '계란', '양파']) await p.locator('.tile', { hasText: n }).first().click();
    assert(await p.locator('.fridge .fitem').count() === 3, '냉장고에 3개가 담기지 않음');
    await p.click('text=요리 추천받기');
    await p.waitForSelector('.rcard');
    assert(/%/.test(await p.locator('.badge').first().textContent()), '일치율 표시 없음');
  });
  await test('S02', '재료·추천', '재료 빼기 → 냉장고·홈 동기화 (UC-B02)', async (p) => {
    await go(p, '/fridge');
    await p.locator('.tile', { hasText: '감자' }).first().click();
    await p.locator('.fridge .rm').first().click();
    assert(await p.locator('.fridge .fitem').count() === 0, '빼기 후에도 재료가 남음');
    await go(p, '/');
    assert(await p.locator('.fridge .fitem:not(.add)').count() === 0, '홈 냉장고와 불일치');
  });
  await test('S03', '재료·추천', '최근 검색어 기록·삭제 (UC-B03)', async (p) => {
    await go(p, '/fridge');
    await p.locator('.tile', { hasText: '대파' }).first().click();
    assert(await p.locator('.chip', { hasText: '대파' }).count() > 0, '최근 검색어에 기록 안 됨');
    await p.click('text=전체 삭제');
    assert(await p.locator('text=아직 검색한 재료가 없어요').count() > 0, '전체 삭제 안 됨');
  });
  await test('S04', '재료·추천', "별칭 검색 '파' → 대파", async (p) => {
    await go(p, '/fridge');
    await p.fill('input[placeholder^="예:"]', '파');
    await p.waitForTimeout(300);
    assert(await p.locator('.tile', { hasText: '대파' }).count() > 0, '대파가 검색되지 않음');
  });
  await test('S05', '레시피', "레시피 검색 '김치' → 김치볶음밥 (UC-D02)", async (p) => {
    await go(p, '/search?tab=recipe');
    await p.fill('input[placeholder*="요리 이름"]', '김치');
    await p.waitForSelector('.rtile');
    assert(await p.locator('.rtile', { hasText: '김치볶음밥' }).count() > 0, '김치볶음밥 없음');
  });
  await test('S06', '레시피', '상세: 인분 + → 재료 양 환산 (UC-D01·D05)', async (p) => {
    await go(p, '/recipes/4');
    const before = await p.locator('.ing .a').first().textContent();
    await p.click('[aria-label="인분 늘리기"]');
    const after = await p.locator('.ing .a').first().textContent();
    assert(before !== after, `양이 그대로 (${before})`);
    assert(await p.locator('.preview li').count() >= 10, '조리 단계가 10개 미만');
  });
  await test('S07', '레시피', '조리 모드: 다음 단계·타이머 동작 (UC-D03)', async (p) => {
    await go(p, '/recipes/4/cook');
    await p.click('text=다음 단계'); await p.click('text=다음 단계');
    assert((await p.textContent('.cook-meta')).includes('3 / '), '3단계로 이동 안 됨');
    const t1 = await p.textContent('.big-timer output');
    await p.click('text=▶ 타이머 시작'); await p.waitForTimeout(2200);
    assert(t1 !== await p.textContent('.big-timer output'), '타이머가 줄지 않음');
  });
  await test('S08', '레시피', '찜 → 찜 탭에 표시 (UC-D04)', async (p) => {
    await go(p, '/recipes/9');
    await p.locator('.actions button', { hasText: '찜하기' }).click();
    await go(p, '/favorites');
    assert(await p.locator('text=두부부침').count() > 0, '찜 목록에 없음');
  });
  await test('S09', '업로드', '등록 → 내 레시피 → 수정 → 삭제 (UC-E01·E02·E03)', async (p) => {
    await go(p, '/register');
    await p.fill('#title', '회귀테스트 볶음'); await p.click('text=다음');
    await p.fill('input[placeholder="재료 이름 검색"]', '계란'); await p.waitForTimeout(300); await p.click('.sugg button >> nth=0'); await p.click('text=다음');
    await p.fill('.stepedit2 textarea >> nth=0', '계란을 볶아요'); await p.fill('.se-timer input >> nth=0', '2');
    await p.click('text=등록하기'); await p.waitForSelector('text=레시피가 등록되었어요');
    await go(p, '/my/recipes');
    assert(await p.locator('.my-rc', { hasText: '회귀테스트 볶음' }).count() === 1, '내 레시피에 없음');
    await p.click('.my-rc-edit'); await p.waitForSelector('#title');
    await p.fill('#title', '회귀테스트 수정됨'); await p.click('text=다음'); await p.click('text=다음'); await p.click('text=수정 완료');
    await p.waitForSelector('text=레시피를 수정했어요');
    await go(p, '/my/recipes');
    assert(await p.locator('.my-rc', { hasText: '회귀테스트 수정됨' }).count() === 1, '수정 반영 안 됨');
    await p.click('.my-rc-del'); await p.click('.sheet .danger-btn'); await p.waitForTimeout(300);
    assert(await p.locator('.my-rc').count() === 0, '삭제 안 됨');
  });
  await test('S10', '커뮤니티', '후기 작성 → 목록·평균 표시 (UC-F01)', async (p) => {
    await go(p, '/recipes/3');
    await p.click('text=후기 쓰기'); await p.click('.stars.lg button >> nth=3');
    await p.fill('.rv-form textarea', '회귀 테스트 후기'); await p.click('.rv-form >> text=등록하기');
    await p.waitForSelector('.rv', { hasText: '회귀 테스트 후기' });
    assert(await p.locator('.rv-avg b').textContent() === '4.0', '후기 평균이 4.0이 아님');
  });
  await test('S11', '커뮤니티', '내 레시피에 질문 → 업로더 답변 (UC-F02)', async (p) => {
    await go(p, '/register');
    await p.fill('#title', '질문테스트'); await p.click('text=다음');
    await p.fill('input[placeholder="재료 이름 검색"]', '감자'); await p.waitForTimeout(300); await p.click('.sugg button >> nth=0'); await p.click('text=다음');
    await p.fill('.stepedit2 textarea >> nth=0', '감자를 삶아요'); await p.click('text=등록하기');
    await p.click('text=등록한 레시피 보기'); await p.waitForSelector('.cm-write');
    await p.fill('.cm-write textarea', '찬밥도 되나요?'); await p.click('.cm-write .mini');
    await p.click('text=답변하기'); await p.fill('.cm-write.reply textarea', '네 됩니다'); await p.click('.cm-write.reply .mini');
    await p.waitForSelector('.cm-ans');
    assert(await p.locator('.cm-ans .cm-badge').count() > 0, '업로더 표시 없음');
  });
  await test('S12', '관리자', '레시피 신고 → 관리자 숨김 → 해제 (UC-F04·G01)', async (p) => {
    await go(p, '/recipes/6');
    await p.click('.actions >> text=신고하기'); await p.click('.sheet >> text=신고하기'); await p.waitForTimeout(300);
    await go(p, '/admin?tab=reports');
    await p.waitForSelector('.rp-card');
    await p.click('.rp-card .b-hide'); await p.click('.sheet button.btn:not(.ghost)'); await p.waitForTimeout(300);
    await go(p, '/recipes/6');
    assert(await p.locator('.hid-banner').count() === 1, '숨김 안내 없음');
    await p.click('.adm-bar >> text=숨김 해제'); await p.waitForTimeout(200);
    assert(await p.locator('.hid-banner').count() === 0, '숨김 해제 안 됨');
  });
  await test('S13', '관리자', '재료 추가·별칭 검색·삭제 (UC-G02)', async (p) => {
    await go(p, '/admin?tab=ingredients');
    await p.click('text=+ 재료 추가'); await p.fill('#an', '고수'); await p.fill('#aa', '향채'); await p.fill('#as', '쪽파'); await p.click('.sheet >> text=저장');
    await p.waitForSelector('.sheet', { state: 'detached' });
    await p.fill('input[placeholder="재료명·별칭 검색"]', '향채');
    await p.waitForSelector('.adm-row >> text=고수');
    assert(await p.locator('.adm-row').count() === 1, '별칭 검색 결과가 1개가 아님');
    await p.click('.adm-row >> nth=0'); await p.click('text=이 재료 삭제'); await p.click('.sheet .danger-btn');
    await p.waitForSelector('.sheet', { state: 'detached' });
    await p.waitForSelector('.adm-row >> text=고수', { state: 'detached', timeout: 3000 }).catch(() => {});
    assert(await p.locator('.adm-row', { hasText: '고수' }).count() === 0, '삭제 안 됨');
  });
  await test('S14', '관리자', '공지 등록 → 홈 배너 표시 (UC-N06)', async (p) => {
    await go(p, '/admin?tab=notices');
    await p.fill('#nm', '회귀 테스트 점검 공지'); await p.click('text=공지 올리기'); await p.waitForTimeout(300);
    await go(p, '/');
    assert((await p.locator('.sys-banner').allTextContents()).some((t) => t.includes('회귀 테스트 점검 공지')), '홈에 공지 배너 없음');
  });
  await test('S15', '기타', '냉장고 모델 선택 → 내 냉장고 화면 표시', async (p) => {
    await go(p, '/settings');
    await p.click('role=tab[name="LG"]'); await p.locator('.fcard').nth(2).click();
    await go(p, '/fridge');
    assert((await p.textContent('.model-bar')).includes('LG 대형'), '모델 표시 안 됨');
  });

  // ───────── 예외 처리 · 오류 응답 ─────────
  await test('E01', '예외', '재료 0개로 추천 → 안내 문구', async (p) => {
    await go(p, '/');
    await p.click('text=요리 추천받기');
    assert((await p.textContent('.hint')).includes('재료를 1개 이상'), '안내 문구 없음');
  });
  await test('E02', '예외', "등록되지 않은 재료 '피자' 검색 → 안내", async (p) => {
    await go(p, '/fridge');
    await p.fill('input[placeholder^="예:"]', '피자'); await p.waitForTimeout(300);
    assert((await p.textContent('.notice.warn')).includes('등록되지 않은 재료'), '안내 없음');
  });
  await test('E03', '예외', "여러 재료 입력 중 없는 재료 → '등록되지 않은 재료' 알림", async (p) => {
    await go(p, '/fridge');
    await p.fill('input[placeholder^="예:"]', '감자 피자'); await p.press('input[placeholder^="예:"]', 'Enter');
    assert((await toastText(p)).includes('등록되지 않은 재료'), '알림 없음');
    assert(await p.locator('.fridge .fitem', { hasText: '감자' }).count() === 1, '있는 재료(감자)는 담겨야 함');
  });
  await test('E04', '예외', "같은 레시피 두 번 신고 → '이미 신고한 게시물이에요'", async (p) => {
    await go(p, '/recipes/5');
    for (let k = 0; k < 2; k++) { await p.click('.actions >> text=신고하기'); await p.click('.sheet >> text=신고하기'); await p.waitForTimeout(250); }
    assert((await toastText(p)).includes('이미 신고한'), '중복 신고 안내 없음');
  });
  await test('E05', '예외', '레시피 이름 없이 등록 → 안내', async (p) => {
    await go(p, '/register');
    await p.click('text=다음');
    assert((await p.textContent('main')).includes('요리 이름을 입력해 주세요'), '안내 없음');
  });
  await test('E06', '예외', '없는 레시피 주소 → 오류 안내 화면', async (p) => {
    await go(p, '/recipes/999999');
    await p.waitForTimeout(500);
    assert(await p.locator('text=레시피를 찾을 수 없어요').count() > 0, '안내 없음');
    assert(await p.locator('text=홈으로').count() > 0, '돌아갈 버튼 없음');
  });
  await test('E07', '예외', '없는 페이지 주소 → 홈으로 이동', async (p) => {
    await go(p, '/abc-not-exist');
    assert(new URL(p.url()).pathname === '/', '홈으로 이동하지 않음');
  });
  await test('E08', '예외', '인터넷 끊김 → 안내 배너, 다시 연결되면 사라짐', async (p, ctx) => {
    await go(p, '/');
    await ctx.setOffline(true); await p.waitForTimeout(200);
    assert((await p.locator('.sys-banner.error').textContent()).includes('인터넷 연결'), '끊김 배너 없음');
    await ctx.setOffline(false); await p.waitForTimeout(200);
    assert(await p.locator('.sys-banner.error').count() === 0, '배너가 남아 있음');
  });
  await test('E09', '예외', '안드로이드 뒤로 가기로 열린 창 닫기', async (p) => {
    await go(p, '/recipes/4');
    await p.click('.actions >> text=신고하기');
    assert(await p.locator('.sheet').count() === 1, '창이 안 열림');
    await p.goBack(); await p.waitForTimeout(200);
    assert(await p.locator('.sheet').count() === 0, '뒤로 가기로 안 닫힘');
    assert(new URL(p.url()).pathname === '/recipes/4', '페이지까지 뒤로 가버림');
  });
  await test('E10', '예외', '가로 화면 → 세로 안내', async (p) => {
    await p.setViewportSize({ width: 780, height: 360 });
    await go(p, '/');
    assert(await p.locator('.rotate-lock').isVisible(), '세로 안내 없음');
  });

  await browser.close();
  if (server) server.kill();

  const pass = results.filter((r) => r.ok).length;
  const md = [
    `# 회귀·시나리오·예외 테스트 결과`, '',
    `- 실행 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
    `- 대상: ${BASE}${process.env.BASE_URL ? '' : ' (배포와 같은 빌드, 체험 모드)'} · 기기: ${DEVICE} (Chromium)`,
    `- 결과: **${pass} / ${results.length} 통과**`, '',
    '| ID | 구분 | 테스트 | 결과 | 시간 | 비고 |', '|---|---|---|---|---|---|',
    ...results.map((r) => `| ${r.id} | ${r.area} | ${r.name} | ${r.ok ? '✅ 통과' : '❌ 실패'} | ${(r.ms / 1000).toFixed(1)}s | ${r.err || ''} |`),
    '',
  ].join('\n');
  writeFileSync(new URL('./regression-result.md', import.meta.url), md);
  console.log(md);
  process.exit(pass === results.length ? 0 : 1);
}
run().catch((e) => { console.error(e); process.exit(1); });
