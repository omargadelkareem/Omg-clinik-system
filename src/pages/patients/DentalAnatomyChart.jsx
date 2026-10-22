import React from "react";
const SHAPES = {
  molar: "M12 3 C4 2 2 8 4 16 C5 20 6 26 10 27 C13 27 12 19 16 19 C20 19 19 27 22 27 C26 26 27 19 28 15 C30 7 27 2 21 3 C17 5 16 5 12 3 Z",
  premolar: "M12 4 C6 2 4 8 5 15 C6 21 9 27 12 27 C14 27 13 20 16 20 C19 20 18 27 21 27 C24 27 27 20 27 15 C28 8 25 2 20 4 C17 6 15 6 12 4 Z",
  canine: "M16 1 C12 7 6 8 7 16 C8 22 11 28 14 28 C16 28 15 21 17 21 C19 21 18 28 21 28 C24 27 26 20 25 15 C24 9 20 7 16 1 Z",
  incisor: "M7 5 Q16 1 25 5 L24 17 C23 23 21 28 18 28 C16 28 17 20 15 20 C13 20 14 28 11 28 C8 27 7 21 7 16 Z"
};
function toothShape(number) {
  const n = number % 10;
  if (n >= 6) return SHAPES.molar;
  if (n === 4 || n === 5) return SHAPES.premolar;
  if (n === 3) return SHAPES.canine;
  return SHAPES.incisor;
}
export default function DentalAnatomyChart({teeth, selectedTooth, onSelect, statuses}) {
  const midpoint = teeth.length / 2;
  return <div className="anatomy-chart" aria-label="مخطط الأسنان">
    <div className="anatomy-jaw-label">الفك العلوي</div>
    {[teeth.slice(0,midpoint),teeth.slice(midpoint)].map((arch,index)=><React.Fragment key={index}>
      {index===1&&<div className="anatomy-jaw-divider"/>}
      <div className="anatomy-tooth-row">{arch.map(number=><button type="button" key={number} className={["anatomy-tooth",selectedTooth===number?"selected":"",statuses.get(number)||""].join(" ")} aria-label={"السن "+number} aria-pressed={selectedTooth===number} onClick={()=>onSelect(number)}>
        {index===1&&<small>{number}</small>}
        <svg viewBox="0 0 32 32" aria-hidden="true" className={index===1?"lower":""}><path d={toothShape(number)} fill="#f8f3e7" stroke="#b9ad9b" strokeWidth="1.25"/><path d="M9 10 Q16 15 23 10" fill="none" stroke="#ded5c6" strokeWidth="1.4"/><path d="M12 6 Q16 10 20 6" fill="none" stroke="#fff" strokeWidth="1.2"/></svg>
        {index===0&&<small>{number}</small>}
      </button>)}</div>
    </React.Fragment>)}
    <div className="anatomy-jaw-label">الفك السفلي</div>
  </div>;
}
