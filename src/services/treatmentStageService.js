import { onValue, push, ref, runTransaction, update } from "firebase/database";
import { database } from "../config/firebase";

const pathFor=(clinicId,patientId,procedureId)=>{
  if(![clinicId,patientId,procedureId].every(id=>/^[a-zA-Z0-9_-]{1,128}$/.test(id||"")))throw Error("Invalid procedure path");
  return `clinics/${clinicId}/patients/${patientId}/procedures/${procedureId}`;
};
const round=x=>Math.round((Number(x)+Number.EPSILON)*100)/100;
export function subscribeTreatmentStages({clinicId,patientId,procedureId},callback,onError){
  return onValue(ref(database,pathFor(clinicId,patientId,procedureId)+"/stages"),snap=>callback(Object.entries(snap.val()||{}).map(([id,v])=>({id,...v})).sort((a,b)=>a.order-b.order)),onError);
}
export async function addTreatmentStage({clinicId,patientId,procedureId,title,doctorId,doctorName,fee,commissionPercent,actorId}){
  if(!title?.trim()||!doctorId?.trim())throw Error("أدخل اسم المرحلة والطبيب المنفذ");
  const amount=round(fee),percent=Number(commissionPercent);
  if(!Number.isFinite(amount)||amount<0||!Number.isFinite(percent)||percent<0||percent>100)throw Error("قيمة المرحلة أو نسبة الطبيب غير صحيحة");
  const path=pathFor(clinicId,patientId,procedureId),id=push(ref(database,path+"/stages")).key;
  const result=await runTransaction(ref(database,path),record=>{
    if(!record||["cancelled","completed"].includes(record.status))return;
    const stages=record.stages||{};
    return {...record,stages:{...stages,[id]:{id,title:title.trim(),doctorId,doctorName:doctorName||"",fee:amount,commissionPercent:percent,status:"planned",order:Object.keys(stages).length+1,createdAt:Date.now(),createdBy:actorId||""}},updatedAt:Date.now()};
  },{applyLocally:false});
  if(!result.committed)throw Error("تعذر إضافة المرحلة للإجراء");
  return id;
}
export async function completeTreatmentStage({clinicId,patientId,procedureId,stageId,actorId}){
  const path=pathFor(clinicId,patientId,procedureId);
  const result=await runTransaction(ref(database,path),record=>{
    const stage=record?.stages?.[stageId];
    if(!stage||stage.status==="completed"||record.status==="cancelled")return;
    if(record.requiresConsent&&!record.consentDocumentId)return;
    return {...record,status:"in_progress",stages:{...record.stages,[stageId]:{...stage,status:"completed",completedAt:Date.now(),completedBy:actorId||""}},updatedAt:Date.now()};
  },{applyLocally:false});
  if(!result.committed)throw Error("المرحلة مكتملة أو الإجراء مغلق، أو يلزم توثيق موافقة المريض");
}
export function getStageCommissions(records){
  return records.flatMap(procedure=>Object.values(procedure.stages||{}).filter(stage=>stage.status==="completed").map(stage=>({
    procedureId:procedure.id,stageId:stage.id,doctorId:stage.doctorId,doctorName:stage.doctorName,
    stage:stage.title,base:round(stage.fee),percent:stage.commissionPercent,
    amount:round(Number(stage.fee)*Number(stage.commissionPercent)/100),
    status:"accrued_not_paid",completedAt:stage.completedAt
  })));
}
