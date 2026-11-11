// 설정 > 내 냉장고: 브랜드별 소형·중형·대형 모델
export const FRIDGES = {
  삼성: [
    { id: 'RB30D4051S9', size: '소형', type: '일반형 냉장고', name: '일반형 냉장고', liters: 306 },
    { id: 'RS84DG5002M9', size: '중형', type: '양문형 냉장고', name: '양문형 냉장고', liters: 852 },
    { id: 'RM70F90R2A', size: '대형', type: '4도어 냉장고', name: 'BESPOKE AI 냉장고 4도어', liters: 905 },
  ],
  LG: [
    { id: 'Q336MQQ171', size: '소형', type: '일반형 냉장고', name: 'LG 모던엣지 AI 오브제컬렉션 Fit & Max', liters: 333 },
    { id: 'M516MQQ012S', size: '중형', type: '양문형 냉장고', name: 'LG 디오스 오브제컬렉션 냉장고 Fit & Max', liters: 504 },
    { id: 'T876MEE011', size: '대형', type: '4도어 냉장고', name: 'LG 디오스 AI 오브제컬렉션 냉장고', liters: 870 },
  ],
};
export const findFridge = (id) => {
  for (const [brand, list] of Object.entries(FRIDGES)) {
    const f = list.find((x) => x.id === id);
    if (f) return { ...f, brand };
  }
  return null;
};
