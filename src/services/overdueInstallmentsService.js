import { onValue, ref } from "firebase/database";
import { database } from "../config/firebase";
export function subscribeOverdueInstallments(clinicId,callback,onError){
 if(!clinicId)return()=>{};
 return onValue(ref(database,`clinics/${clinicId}`),snapshot=>{
  const clinic=snapshot.val()||{},now=new Date().toISOString().slice(0,10),results=[];
  for(const [patientId,patient] of Object.entries(clinic.patients||{})){
   for(const [invoiceId,plan] of Object.entries(patient.installmentPlans||{})){
    const tx=clinic.finance?.transactions?.[invoiceId];
    if(!tx||tx.status==="cancelled"||Number(tx.remaining)<=0)continue;
    const payments=Object.values(clinic.finance?.payments||{}).filter(p=>p.transactionId===invoiceId);
    let credit=payments.reduce((sum,p)=>sum+Number(p.amount||0),0)-Number(plan.deposit||0);
    for(const item of plan.installments||[]){
     const paid=Math.max(0,Math.min(Number(item.amount),credit));credit=Math.max(0,credit-paid);
     const due=Math.max(0,Math.round((Number(item.amount)-paid)*100)/100);
     if(item.dueDate<now&&due>0)results.push({patientId,invoiceId,invoiceNumber:tx.invoiceNumber||"",dueDate:item.dueDate,amount:due,installment:item.index});
    }
   }
  }
  callback(results.sort((a,b)=>a.dueDate.localeCompare(b.dueDate)));
 },onError);
}
