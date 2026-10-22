import { useState } from "react";
import { addTreatmentStage, completeTreatmentStage, getStageCommissions } from "../../services/treatmentStageService";
import "./TreatmentStagesPanel.css";
export default function TreatmentStagesPanel({clinicId,patientId,records,actorId}){
 const [selected,setSelected]=useState("");
 const [draft,setDraft]=useState({title:"",doctorId:"",doctorName:"",fee:"",commissionPercent:""});
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const procedure=records.find(x=>x.id===selected);
 const commissions=getStageCommissions(records);
 const create=async e=>{e.preventDefault();setBusy(true);setMessage("");try{
  await addTreatmentStage({clinicId,patientId,procedureId:selected,actorId,...draft});
  setDraft({title:"",doctorId:"",doctorName:"",fee:"",commissionPercent:""});setMessage("تم حفظ المرحلة");
 }catch(err){setMessage(err.message)}finally{setBusy(false)}};
 const finish=async stageId=>{setBusy(true);setMessage("");try{await completeTreatmentStage({clinicId,patientId,procedureId:selected,stageId,actorId});setMessage("تم إتمام المرحلة وتسجيل استحقاق الطبيب");}catch(err){setMessage(err.message)}finally{setBusy(false)}};
 return <section className="ts-panel" dir="rtl"><h3>مراحل العلاج ونسب الأطباء</h3><p>كل مرحلة مرتبطة بالطبيب المنفذ، والنسبة تُحسب عند اكتمال المرحلة فقط. المبالغ المعروضة مستحقات وليست رواتب مدفوعة.</p>
 <label>اختر الإجراء<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">اختر إجراءً من الخطة</option>{records.filter(x=>x.status!=="cancelled").map(x=><option key={x.id} value={x.id}>{x.name} — {x.toothNumber||"بدون سن"}</option>)}</select></label>
 {procedure&&<><form onSubmit={create} className="ts-form"><label>اسم المرحلة<input required value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><label>معرّف الطبيب<input required value={draft.doctorId} onChange={e=>setDraft({...draft,doctorId:e.target.value})}/></label><label>اسم الطبيب<input value={draft.doctorName} onChange={e=>setDraft({...draft,doctorName:e.target.value})}/></label><label>قيمة المرحلة<input type="number" min="0" step=".01" required value={draft.fee} onChange={e=>setDraft({...draft,fee:e.target.value})}/></label><label>نسبة الطبيب %<input type="number" min="0" max="100" step=".01" required value={draft.commissionPercent} onChange={e=>setDraft({...draft,commissionPercent:e.target.value})}/></label><button disabled={busy} type="submit">+ إضافة مرحلة</button></form>
 <div className="ts-table"><table><thead><tr><th>المرحلة</th><th>الطبيب</th><th>قيمة المرحلة</th><th>نسبة الطبيب</th><th>مستحق الطبيب</th><th>الحالة</th></tr></thead><tbody>{Object.values(procedure.stages||{}).sort((a,b)=>a.order-b.order).map(stage=><tr key={stage.id}><td>{stage.title}</td><td>{stage.doctorName||stage.doctorId}</td><td>{stage.fee}</td><td>{stage.commissionPercent}%</td><td>{(Number(stage.fee)*Number(stage.commissionPercent)/100).toFixed(2)} ج.م</td><td>{stage.status==="completed"?"مكتمل":<button disabled={busy} type="button" onClick={()=>finish(stage.id)}>إتمام المرحلة</button>}</td></tr>)}</tbody></table></div></>}
 <div className="ts-summary"><strong>مستحقات الأطباء من المراحل المكتملة: {commissions.reduce((sum,x)=>sum+x.amount,0).toFixed(2)} ج.م</strong><small>المستحقات غير مرتبطة بصرف الرواتب أو التسويات المحاسبية بعد.</small></div>{message&&<p role="status">{message}</p>}</section>
}
