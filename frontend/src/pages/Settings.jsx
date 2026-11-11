import { useState } from 'react';
import Header from '../components/Header.jsx';
import { useApp } from '../store.jsx';
import { FRIDGES, findFridge } from '../data/fridges.js';
import { CheckI } from '../components/Icons.jsx';

// 설정: 내 냉장고 선택 (브랜드 → 소형·중형·대형)
export default function Settings() {
  const { fridge, setFridge, toast } = useApp();
  const cur = findFridge(fridge);
  const [brand, setBrand] = useState(cur?.brand || '삼성');
  const pick = (f) => { setFridge(f.id); toast(`${brand} ${f.size} 냉장고로 설정했어요`); };
  return (
    <>
      <Header title="냉장고 모델" />
      <main className="page">
        <div className="sec-h"><h2>내 냉장고</h2></div>
        <p className="muted small" style={{ margin: '-6px 0 0' }}>집에 있는 냉장고를 골라주세요</p>
        <div className="seg" role="tablist">
          {Object.keys(FRIDGES).map((b) => (
            <button key={b} role="tab" aria-selected={brand === b} onClick={() => setBrand(b)}>{b}</button>
          ))}
        </div>
        <div className="fridges">
          {FRIDGES[brand].map((f) => {
            const on = fridge === f.id;
            return (
              <button key={f.id} className={'fcard' + (on ? ' on' : '')} onClick={() => pick(f)} aria-pressed={on}>
                <div className="fz">{f.size}</div>
                <div className="fi">
                  <b>{f.type}</b>
                  {f.name !== f.type && <span>{f.name}</span>}
                  <small>{f.id} · {f.liters}L</small>
                </div>
                <div className="fc">{on && <CheckI />}</div>
              </button>
            );
          })}
        </div>
        {cur && <button className="link" onClick={() => { setFridge(null); toast('냉장고 선택을 해제했어요'); }}>선택 해제</button>}
      </main>
    </>
  );
}
