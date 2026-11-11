import { useSearchParams } from 'react-router-dom';
import Header from '../components/Header.jsx';
import RecipeSearch from './RecipeSearch.jsx';
import { FridgePanel } from './Fridge.jsx';

// 검색 탭: [레시피 검색] 요리 이름·재료로 레시피 찾기 / [재료 담기] 1-② 재료 검색 (UC-B01)
// 하단 탭 검색 → 레시피 검색. 재료 담기 탭은 내 냉장고 화면과 같은 내용(담으면 냉장고에 바로 반영)
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
        {mode === 'recipe' ? <RecipeSearch /> : <FridgePanel />}
      </main>
    </>
  );
}
