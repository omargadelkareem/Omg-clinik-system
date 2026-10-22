import { onValue, ref, runTransaction } from "firebase/database";
import { database } from "../config/firebase";

const money = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const root = (clinicId, patientId) => {
  if (![clinicId, patientId].every(id => /^[A-Za-z0-9_-]{1,128}$/.test(id || ""))) throw new Error("Invalid clinic or patient");
  return `clinics/${clinicId}/patients/${patientId}/installmentPlans`;
};
export function subscribeInstallmentPlans(clinicId, patientId, callback, onError) {
  return onValue(ref(database, root(clinicId,patientId)), snapshot => callback(Object.entries(snapshot.val()||{}).map(([id,item])=>({id,...item}))),onError);
}
export async function saveInstallmentPlan({clinicId,patientId,transaction,deposit=0,count=1,firstDueDate,actorId}) {
  if (!transaction?.id || !Number.isFinite(Number(transaction.amount)) || Number(transaction.amount)<=0) throw new Error("اختر فاتورة صالحة");
  if (transaction.status==="cancelled") throw new Error("الفاتورة ملغاة");
  const amount=money(transaction.amount);
  const initial=money(deposit);
  const n=Number(count);
  if (!Number.isInteger(n)||n<1||n>36) throw new Error("عدد الأقساط من 1 إلى 36");
  if (!Number.isFinite(initial)||initial<0||initial>amount) throw new Error("المقدم غير صحيح");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDueDate)||!Number.isFinite(Date.parse(firstDueDate+"T12:00:00"))) throw new Error("حدد تاريخ أول قسط");
  const base=money((amount-initial)/n);
  const installments=Array.from({length:n},(_,i)=>{
    const first=new Date(firstDueDate+"T12:00:00");
    const due=new Date(first.getFullYear(),first.getMonth()+i,1,12);
    const lastDay=new Date(due.getFullYear(),due.getMonth()+1,0).getDate();
    due.setDate(Math.min(first.getDate(),lastDay));
    const sum=i===n-1?money(amount-initial-base*(n-1)):base;
    return {index:i+1,dueDate:[due.getFullYear(),String(due.getMonth()+1).padStart(2,"0"),String(due.getDate()).padStart(2,"0")].join("-"),amount:sum};
  });
  const planRef=ref(database,`${root(clinicId,patientId)}/${transaction.id}`);
  const result=await runTransaction(planRef,current=>{
    if(current)return;
    return {transactionId:transaction.id,invoiceNumber:transaction.invoiceNumber||"",amount,deposit:initial,installments,createdAt:Date.now(),createdBy:actorId||""};
  },{applyLocally:false});
  if(!result.committed)throw new Error("يوجد جدول أقساط بالفعل لهذه الفاتورة");
  return result.snapshot.val();
}
export function installmentProgress(plan, payments) {
  const collected=money(payments.filter(p=>p.transactionId===plan.transactionId).reduce((sum,p)=>sum+(Number(p.amount)||0),0));
  let remaining=collected;
  const depositPaid=Math.min(remaining,plan.deposit||0);remaining=money(remaining-depositPaid);
  const rows=(plan.installments||[]).map(item=>{
    const paid=Math.min(item.amount,remaining);
    remaining=money(remaining-paid);
    return {...item,paid,remaining:money(item.amount-paid),status:paid>=item.amount?"paid":paid>0?"partial":"pending"};
  });
  return {depositPaid,rows,collected};
}
