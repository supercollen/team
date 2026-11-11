import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store.jsx';
import { api } from '../api/index.js';
import Header from '../components/Header.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';
import Modal from '../components/Modal.jsx';
import { IngPic } from '../components/Pic.jsx';
import IngredientSearch from '../components/IngredientSearch.jsx';

// 내 냉장고 화면 = 검색 탭의 '재료 담기'와 같은 내용 (UC-B01·B02)
export default function Fridge() {
  return (
    <>
      <Header title="내 냉장고" />
      <main className="page"><FridgePanel /></main>
    </>
  );
}

// 위에는 내 냉장고(선택한 재료), 아래에서 재료를 검색·분류로 골라 담기. 담으면 바로 냉장고에 반영(로그인 시 DB 저장)
export function FridgePanel() {
  const nav = useNavigate();
  const { selected, setSelected, toggleSelected, addRecent, toast } = useApp();
  const [clear, setClear] = useState(false);
  const recommend = () => {
    if (!selected.length) return toast('재료를 1개 이상 담아 주세요');
    addRecent(selected); nav('/results');
  };
  return (
    <>
        <section className="sec">
          <div className="sec-h">
            <h2>🧊 내 냉장고 <span className="count">{selected.length}</span></h2>
            {selected.length > 0 && <button className="link" onClick={() => setClear(true)}>모두 지우기</button>}
          </div>
          {selected.length ? (
            <div className="fridge">
              {selected.map((id) => { const i = api.ingredient(id); return (
                <div key={id} className="fitem"><IngPic name={i.name} emoji={i.emoji} className="ico" /><span className="fname">{i.name}</span>
                  <button className="rm" onClick={() => toggleSelected(id)} aria-label={`${i.name} 빼기`}>×</button></div>
              ); })}
            </div>
          ) : <div className="fridge-empty">🧊 냉장고가 비어 있어요<br /><span>아래에서 가진 재료를 골라 담아 주세요</span></div>}
        </section>
        <section className="sec">
          <div className="sec-h"><h2>재료 담기</h2></div>
          <IngredientSearch cta={false} autoFocus={false} />
        </section>
        <div className="sticky-cta"><PrimaryButton onClick={recommend}>요리 추천받기{selected.length > 0 && ` · 재료 ${selected.length}개`}</PrimaryButton></div>
      {clear && (
        <Modal onClose={() => setClear(false)}>
          <h3>냉장고를 비울까요?</h3>
          <p className="muted">담아 둔 재료 {selected.length}개가 모두 빠져요.</p>
          <div className="btn-row"><PrimaryButton ghost onClick={() => setClear(false)}>취소</PrimaryButton><PrimaryButton onClick={() => { setSelected([]); setClear(false); toast('냉장고를 비웠어요'); }}>비우기</PrimaryButton></div>
        </Modal>
      )}
    </>
  );
}
