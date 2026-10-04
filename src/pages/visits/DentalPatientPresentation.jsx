import { useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import Dental3DViewer from "./Dental3DViewer";

const STATUS_LABELS={caries:"تسوس",filling:"حشو",root_canal:"علاج جذور",crown:"تاج",implant:"زرعة",missing:"سن مفقود",fracture:"كسر",healthy:"سليم"};

export default function DentalPatientPresentation({ patient, chart={}, treatmentPlan=[], sessions=[], onClose }) {
  const [step,setStep]=useState(0);
  const affected=Object.entries(chart).filter(([,v])=>v?.status && v.status!=="healthy");
  const total=treatmentPlan.reduce((s,x)=>s+(Number(x.cost)||0),0);
  const paid=sessions.reduce((s,x)=>s+(Number(x.paid)||0),0);
  const steps=["الحالة الحالية","خطة العلاج","التكلفة والجلسات"];
  return <div className="patient-presentation" role="dialog" aria-modal="true">
    <header className="presentation-header">
      <div><span>OMG CLINIC · DENTAL</span><strong>{patient?.name || "خطة علاج الأسنان"}</strong></div>
      <div className="presentation-progress">{steps.map((x,i)=><span key={x} className={i===step?"active":i<step?"done":""}>{i+1}<small>{x}</small></span>)}</div>
      <button type="button" onClick={onClose}><X size={20}/></button>
    </header>
    <main className="presentation-body">
      {step===0 && <div className="presentation-current">
        <div className="presentation-copy"><span className="presentation-kicker">حالتك الحالية</span><h2>نشرح لك الحالة بشكل واضح قبل بدء العلاج</h2><p>الأسنان الملوّنة على النموذج هي الأسنان التي سجل الطبيب عليها ملاحظات أثناء الكشف.</p>
          <div className="presentation-findings">{affected.length?affected.map(([tooth,v])=><div key={tooth}><strong>{tooth}</strong><span>{STATUS_LABELS[v.status]||v.status}</span>{Object.keys(v.surfaces||{}).filter(k=>v.surfaces[k]).length>0&&<small>أسطح: {Object.keys(v.surfaces).filter(k=>v.surfaces[k]).map(k=>k[0].toUpperCase()).join(" · ")}</small>}</div>):<div className="presentation-clean">لا توجد حالات مسجلة على الأسنان حتى الآن.</div>}</div>
        </div>
        <div className="presentation-model"><Dental3DViewer value={chart}/></div>
      </div>}
      {step===1 && <div className="presentation-plan"><span className="presentation-kicker">الخطة المقترحة</span><h2>هنمشي في العلاج خطوة بخطوة</h2>
        <div className="presentation-plan-list">{treatmentPlan.length?treatmentPlan.map((item,index)=><article key={item.id}><span>{index+1}</span><div><small>السن {item.tooth}</small><strong>{item.procedure || "إجراء علاجي"}</strong><p>{item.status==="completed"?"تم تنفيذ هذا الإجراء":item.status==="in_progress"?"العلاج جارٍ":"مخطط للتنفيذ"}</p></div><b>{Number(item.cost||0).toLocaleString("ar-EG")} ج.م</b></article>):<div className="presentation-empty">لم تتم إضافة إجراءات لخطة العلاج بعد.</div>}</div>
      </div>}
      {step===2 && <div className="presentation-finance"><span className="presentation-kicker">ملخص الخطة</span><h2>التكلفة والجلسات في صورة بسيطة</h2>
        <div className="presentation-numbers"><div><span>إجمالي الخطة</span><strong>{total.toLocaleString("ar-EG")}</strong><small>جنيه مصري</small></div><div><span>المدفوع</span><strong>{paid.toLocaleString("ar-EG")}</strong><small>جنيه مصري</small></div><div><span>المتبقي</span><strong>{Math.max(0,total-paid).toLocaleString("ar-EG")}</strong><small>جنيه مصري</small></div><div><span>الجلسات</span><strong>{sessions.length || "—"}</strong><small>جلسة مسجلة</small></div></div>
        <div className="presentation-note"><Maximize2 size={19}/><div><strong>خطة العلاج قابلة للتحديث</strong><p>قد تتغير بعض الخطوات حسب استجابة الحالة ونتائج الأشعة والفحص أثناء الجلسات.</p></div></div>
      </div>}
    </main>
    <footer className="presentation-footer"><button type="button" disabled={step===0} onClick={()=>setStep(s=>Math.max(0,s-1))}><ChevronRight size={17}/> السابق</button><span>{step+1} / {steps.length}</span>{step<steps.length-1?<button type="button" className="primary" onClick={()=>setStep(s=>s+1)}>التالي <ChevronLeft size={17}/></button>:<button type="button" className="primary" onClick={onClose}>إنهاء العرض</button>}</footer>
  </div>;
}
