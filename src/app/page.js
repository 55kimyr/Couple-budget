“use client”;
import { useState, useEffect, useMemo, useRef } from “react”;
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from “recharts”;
import * as XLSX from “xlsx”;

// ─── Constants ───────────────────────────────────────────────
const PERSONAL_EXPENSE_CATS = [“🍽️ 식비”,“🚇 교통”,“🛍️ 쇼핑”,“☕ 카페”,“💊 의료/건강”,“📱 통신”,“📚 자기계발”,“🏠 주거/관리비”,“🧾 기타”];
const SHARED_DAILY_CATS     = [“🍽️ 데이트 식사”,“☕ 카페/디저트”,“🎬 영화/문화”,“🛒 장보기”,“🚗 교통/주차”,“🏠 생활용품”,“🎁 선물”,“🧾 기타 일상”];
const SHARED_EVENT_CATS     = [“✈️ 여행”,“🎂 기념일”,“💍 이벤트”,“🎊 파티”,“🏨 숙박”,“🎡 놀이공원”,“👗 커플 쇼핑”,“🎁 특별 선물”];
const INCOME_SALARY_CATS    = [“💰 월급”,“💰 성과급/보너스”];
const INCOME_EXTRA_CATS     = [“🎁 부모님/용돈”,“💼 부업/프리랜서”,“📈 투자수익”,“🏦 기타 수입”];
const SAVING_CATS           = [“🐷 비상금”,“🏖️ 여행 적금”,“🏠 내집마련”,“💍 결혼 준비”,“📦 기타 저축”];
const PIE_COLORS            = [”#2D7DD2”,”#F26419”,”#44BBA4”,”#E94F37”,”#8338EC”,”#FB5607”,”#3A86FF”,”#06D6A0”,”#FFB703”,”#E63946”];

// ─── Helpers ─────────────────────────────────────────────────
const uid      = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const fmt      = n  => “₩” + Number(n||0).toLocaleString(“ko-KR”);
const todayStr = () => new Date().toISOString().slice(0,10);
const monthOf  = d  => d.slice(0,7);
const prevM    = m  => { const d=new Date(m+”-01”); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7); };
const nextM    = m  => { const d=new Date(m+”-01”); d.setMonth(d.getMonth()+1); return d.toISOString().slice(0,7); };
const monthLabel = m => { const [y,mo]=m.split(”-”); return `${y}년 ${Number(mo)}월`; };
const yearOf   = d  => d.slice(0,4);
const last6    = cur => {
const r=[]; const d=new Date(cur+”-01”);
for(let i=5;i>=0;i–){ const t=new Date(d); t.setMonth(t.getMonth()-i); r.push(t.toISOString().slice(0,7)); }
return r;
};
const daysInMonth = m => { const [y,mo]=m.split(”-”); return new Date(Number(y),Number(mo),0).getDate(); };

function useLS(key, init) {
const [v,set] = useState(init);
useEffect(() => {
try { const s=localStorage.getItem(key); if(s) set(JSON.parse(s)); } catch {}
}, []);
useEffect(() => {
try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}, [v, key]);
return [v, set];
}

// ─── Cloud sync via API routes ────────────────────────────────
async function cloudLoad() {
try { const r=await fetch(”/api/shared”); const j=await r.json(); return j.data||[]; } catch { return []; }
}
async function cloudSave(data) {
try { await fetch(”/api/shared”,{method:“POST”,headers:{“Content-Type”:“application/json”},body:JSON.stringify({data})}); return true; } catch { return false; }
}

// ─── UI Primitives ────────────────────────────────────────────
const Card = ({children,style={}}) => <div style={{background:”#fff”,borderRadius:20,padding:“20px”,boxShadow:“0 2px 16px rgba(0,0,0,.06)”,…style}}>{children}</div>;
const Lbl  = ({children}) => <div style={{fontSize:11,fontWeight:700,color:”#AAB0BC”,letterSpacing:.8,marginBottom:6,textTransform:“uppercase”}}>{children}</div>;
const Inp  = ({style={},…p}) => <input {…p} style={{width:“100%”,padding:“10px 14px”,borderRadius:12,border:“1.5px solid #E8ECF0”,fontSize:15,outline:“none”,boxSizing:“border-box”,background:”#FAFBFC”,fontFamily:“inherit”,…style}}/>;
const KBtn = ({label,active,onClick,color}) => <button onClick={onClick} style={{flex:1,padding:“9px 0”,borderRadius:12,border:“none”,cursor:“pointer”,background:active?color:”#F0F2F5”,color:active?”#fff”:”#999”,fontWeight:700,fontSize:12}}>{label}</button>;
const SecTitle = ({children,color=”#1A1D23”}) => <div style={{fontWeight:700,fontSize:14,color,marginBottom:12}}>{children}</div>;
const ActionBtn = ({onClick,color=”#1A1D23”,outline,children,disabled,style={}}) => (
<button onClick={onClick} disabled={disabled} style={{padding:“11px 0”,borderRadius:14,border:outline?`1.5px solid ${color}`:“none”,background:outline?”#fff”:disabled?”#E0E4EA”:color,color:outline?color:”#fff”,fontWeight:700,fontSize:14,cursor:disabled?“not-allowed”:“pointer”,width:“100%”,…style}}>{children}</button>
);

const BottomSheet = ({open,onClose,children,title}) => {
if(!open) return null;
return (
<div style={{position:“fixed”,inset:0,zIndex:200,background:“rgba(0,0,0,.4)”,display:“flex”,alignItems:“flex-end”,justifyContent:“center”}} onClick={onClose}>
<div style={{background:”#fff”,borderRadius:“24px 24px 0 0”,width:“100%”,maxWidth:520,padding:“20px 20px 48px”,maxHeight:“92vh”,overflowY:“auto”}} onClick={e=>e.stopPropagation()}>
<div style={{width:40,height:4,background:”#E0E4EA”,borderRadius:2,margin:“0 auto 20px”}}/>
{title && <div style={{fontWeight:800,fontSize:18,color:”#1A1D23”,marginBottom:18}}>{title}</div>}
{children}
</div>
</div>
);
};

// ─── Setup ───────────────────────────────────────────────────
function SetupScreen({onDone}) {
const [name,setName]=useState(””);
return (
<div style={{minHeight:“100vh”,display:“flex”,alignItems:“center”,justifyContent:“center”,background:”#F5F7FA”,padding:20}}>
<Card style={{width:“100%”,maxWidth:380,textAlign:“center”}}>
<div style={{fontSize:44,marginBottom:16}}>💑</div>
<div style={{fontSize:22,fontWeight:900,color:”#1A1D23”,marginBottom:8}}>커플 가계부</div>
<div style={{fontSize:13,color:”#AAB0BC”,marginBottom:28,lineHeight:1.7}}>내 이름을 입력하면 시작해요<br/>애인도 같은 링크에서 이름 입력하면 공유 탭이 연결돼요</div>
<Lbl>내 이름</Lbl>
<Inp value={name} onChange={e=>setName(e.target.value)} placeholder=“이름 입력” style={{marginBottom:16,textAlign:“center”,fontSize:18,fontWeight:700}} onKeyDown={e=>e.key===“Enter”&&name.trim()&&onDone(name.trim())}/>
<ActionBtn onClick={()=>name.trim()&&onDone(name.trim())} disabled={!name.trim()}>시작하기</ActionBtn>
</Card>
</div>
);
}

// ─── Card OCR Modal (with real file upload) ───────────────────
function CardOCRModal({open,onClose,onImport}) {
const [step,setStep]      = useState(“upload”);
const [loading,setLoading]= useState(false);
const [items,setItems]    = useState([]);
const [error,setError]    = useState(””);
const [preview,setPreview]= useState(null);
const fileRef             = useRef();

function reset(){ setStep(“upload”); setItems([]); setError(””); setLoading(false); setPreview(null); }

async function handleFile(file) {
if(!file||!file.type.startsWith(“image/”)) return;
const objectUrl = URL.createObjectURL(file);
setPreview(objectUrl);
setLoading(true); setError(””);
try {
const base64 = await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(”,”)[1]); r.onerror=rej; r.readAsDataURL(file); });
const resp = await fetch(”/api/ocr”,{
method:“POST”,
headers:{“Content-Type”:“application/json”},
body:JSON.stringify({base64, mediaType:file.type})
});
const data = await resp.json();
if(data.error) throw new Error(data.error);
setItems(data.items.map(p=>({
…p, id:uid(),
cat:PERSONAL_EXPENSE_CATS[0],
tab:“personal”, source:“salary”, isShared:false, eventType:“daily”, selected:true, editing:false
})));
setStep(“review”);
} catch(e) {
setError(“내역을 읽지 못했어요. 카드 명세서 이미지인지 확인해주세요.”);
}
setLoading(false);
}

function updateItem(id,changes){ setItems(prev=>prev.map(x=>x.id===id?{…x,…changes}:x)); }

function doImport(){
const selected=items.filter(x=>x.selected);
onImport(selected);
reset(); onClose();
}

if(!open) return null;
return (
<BottomSheet open={open} onClose={()=>{reset();onClose();}} title={step===“upload”?“📸 카드 내역 가져오기”:“내역 확인 및 수정”}>
{step===“upload” && (
<>
<div style={{fontSize:13,color:”#aaa”,marginBottom:20,lineHeight:1.7}}>카드사 앱의 결제 내역을 캡처해서 올리면<br/>AI가 자동으로 내역을 읽어드려요</div>
<input ref={fileRef} type=“file” accept=“image/*” capture=“environment” style={{display:“none”}} onChange={e=>handleFile(e.target.files[0])}/>
{loading ? (
<div style={{textAlign:“center”,padding:“48px 0”}}>
<div style={{fontSize:40,marginBottom:16}}>🔍</div>
{preview && <img src={preview} alt=“preview” style={{width:“100%”,borderRadius:16,marginBottom:16,maxHeight:200,objectFit:“cover”}}/>}
<div style={{fontSize:14,color:”#aaa”}}>내역을 읽는 중이에요…</div>
</div>
) : (
<>
<button onClick={()=>fileRef.current.click()} style={{width:“100%”,padding:“36px 0”,borderRadius:20,border:“2px dashed #E0E4EA”,background:”#FAFBFC”,color:”#aaa”,fontSize:14,fontWeight:600,cursor:“pointer”,display:“flex”,flexDirection:“column”,alignItems:“center”,gap:10}}>
<span style={{fontSize:40}}>📷</span>
<span>캡처 이미지 선택 또는 촬영</span>
<span style={{fontSize:12,color:”#C0C6D0”}}>카드사 앱 결제내역 캡처 권장</span>
</button>
{error && <div style={{marginTop:12,color:”#E94F37”,fontSize:13,textAlign:“center”,padding:“10px”,background:”#FFF5F5”,borderRadius:10}}>{error}</div>}
<ActionBtn outline color="#AAB0BC" onClick={onClose} style={{marginTop:16}}>취소</ActionBtn>
</>
)}
</>
)}
{step===“review” && (
<>
<div style={{fontSize:13,color:”#aaa”,marginBottom:16}}>{items.filter(x=>x.selected).length}개 선택됨 · 내용을 확인하고 수정하세요</div>
{items.map(item=>(
<div key={item.id} style={{borderRadius:16,border:`2px solid ${item.selected?"#2D7DD2":"#E8ECF0"}`,padding:“14px”,marginBottom:10,background:item.selected?”#F8FBFF”:”#FAFAFA”}}>
<div style={{display:“flex”,alignItems:“center”,gap:10,marginBottom:item.editing?12:0}}>
<button onClick={()=>updateItem(item.id,{selected:!item.selected})} style={{width:22,height:22,borderRadius:6,border:`2px solid ${item.selected?"#2D7DD2":"#ccc"}`,background:item.selected?”#2D7DD2”:”#fff”,display:“flex”,alignItems:“center”,justifyContent:“center”,cursor:“pointer”,flexShrink:0}}>
{item.selected&&<span style={{color:”#fff”,fontSize:12}}>✓</span>}
</button>
<div style={{flex:1,minWidth:0}}>
<div style={{fontWeight:700,fontSize:14,color:”#1A1D23”}}>{item.rawName}</div>
<div style={{fontSize:12,color:”#aaa”}}>{item.date} · <span style={{fontWeight:700,color:”#E94F37”}}>{fmt(item.amount)}</span></div>
</div>
<button onClick={()=>updateItem(item.id,{editing:!item.editing})} style={{background:“none”,border:“none”,cursor:“pointer”,fontSize:12,color:”#aaa”,padding:“4px 8px”,borderRadius:8,border:“1px solid #eee”}}>
{item.editing?“접기”:“수정 ✏️”}
</button>
</div>
{item.editing && (
<div style={{borderTop:“1px solid #F0F2F5”,paddingTop:12,marginTop:4}}>
<div style={{marginBottom:10}}><Lbl>실제 내용 메모</Lbl><Inp value={item.memo} placeholder=“예: 스타벅스 라떼, GS편의점” onChange={e=>updateItem(item.id,{memo:e.target.value})}/></div>
<div style={{display:“grid”,gridTemplateColumns:“1fr 1fr”,gap:8,marginBottom:10}}>
<div><Lbl>날짜</Lbl><Inp type=“date” value={item.date} onChange={e=>updateItem(item.id,{date:e.target.value})}/></div>
<div><Lbl>금액</Lbl><Inp type=“number” value={item.amount} onChange={e=>updateItem(item.id,{amount:Number(e.target.value)})}/></div>
</div>
<div style={{marginBottom:10}}>
<Lbl>개인 / 공유</Lbl>
<div style={{display:“flex”,gap:8}}>
<KBtn label=“👤 개인” active={item.tab===“personal”} onClick={()=>updateItem(item.id,{tab:“personal”})} color=”#1A1D23”/>
<KBtn label=“💑 공유” active={item.tab===“shared”} onClick={()=>updateItem(item.id,{tab:“shared”})} color=”#2D7DD2”/>
</div>
</div>
{item.tab===“personal” && (
<>
<div style={{marginBottom:10}}>
<Lbl>어디서?</Lbl>
<div style={{display:“flex”,gap:8}}>
<KBtn label=“💰 월급” active={item.source===“salary”} onClick={()=>updateItem(item.id,{source:“salary”})} color=”#E94F37”/>
<KBtn label=“🎁 월급 외” active={item.source===“extra”} onClick={()=>updateItem(item.id,{source:“extra”})} color=”#2D7DD2”/>
</div>
</div>
<button onClick={()=>updateItem(item.id,{isShared:!item.isShared})} style={{width:“100%”,padding:“9px”,borderRadius:10,border:“2px solid”,borderColor:item.isShared?”#2D7DD2”:”#E8ECF0”,background:item.isShared?”#EEF6FF”:”#fff”,color:item.isShared?”#2D7DD2”:”#bbb”,fontWeight:700,fontSize:13,cursor:“pointer”,marginBottom:10}}>
{item.isShared?“💑 공유 지출로 집계”:“공유 지출로 표시”}
</button>
</>
)}
{item.tab===“shared” && (
<div style={{marginBottom:10}}>
<Lbl>지출 유형</Lbl>
<div style={{display:“flex”,gap:8}}>
<KBtn label=“🗓️ 일상” active={item.eventType===“daily”} onClick={()=>updateItem(item.id,{eventType:“daily”})} color=”#2D7DD2”/>
<KBtn label=“🎉 이벤트” active={item.eventType===“event”} onClick={()=>updateItem(item.id,{eventType:“event”})} color=”#F26419”/>
</div>
</div>
)}
<div><Lbl>카테고리</Lbl>
<div style={{display:“flex”,flexWrap:“wrap”,gap:5}}>
{(item.tab===“personal”?PERSONAL_EXPENSE_CATS:item.eventType===“event”?SHARED_EVENT_CATS:SHARED_DAILY_CATS).map(c=>(
<button key={c} onClick={()=>updateItem(item.id,{cat:c})} style={{padding:“5px 10px”,borderRadius:16,border:“none”,cursor:“pointer”,background:item.cat===c?”#1A1D23”:”#F0F2F5”,color:item.cat===c?”#fff”:”#666”,fontSize:11,fontWeight:600}}>{c}</button>
))}
</div>
</div>
</div>
)}
</div>
))}
<div style={{display:“flex”,gap:10,marginTop:12}}>
<ActionBtn outline color="#AAB0BC" onClick={reset} style={{flex:1}}>다시</ActionBtn>
<ActionBtn color="#2D7DD2" onClick={doImport} style={{flex:2}}>{items.filter(x=>x.selected).length}개 가져오기</ActionBtn>
</div>
</>
)}
</BottomSheet>
);
}

// ─── Personal Entry Modal ─────────────────────────────────────
function PersonalModal({open,onClose,onSave,edit}) {
const [kind,setKind]     = useState(edit?.kind||“expense”);
const [amount,setAmt]    = useState(edit?.amount||””);
const [cat,setCat]       = useState(edit?.cat||PERSONAL_EXPENSE_CATS[0]);
const [memo,setMemo]     = useState(edit?.memo||””);
const [date,setDate]     = useState(edit?.date||todayStr());
const [source,setSource] = useState(edit?.source||“salary”);
const [isShared,setShared]= useState(edit?.isShared||false);

useEffect(()=>{ if(!edit) setCat(kind===“expense”?PERSONAL_EXPENSE_CATS[0]:kind===“income_salary”?INCOME_SALARY_CATS[0]:kind===“income_extra”?INCOME_EXTRA_CATS[0]:SAVING_CATS[0]); },[kind]);
if(!open) return null;
const isExp=kind===“expense”;
const kColor=isExp?”#E94F37”:kind===“saving”?”#8338EC”:”#44BBA4”;
const cats=isExp?PERSONAL_EXPENSE_CATS:kind===“income_salary”?INCOME_SALARY_CATS:kind===“income_extra”?INCOME_EXTRA_CATS:SAVING_CATS;
function save(){ const n=Number(amount); if(!n||n<=0) return; onSave({id:edit?.id||uid(),kind,amount:n,cat,memo,date,…(isExp?{source,isShared}:{})}); onClose(); }
return (
<BottomSheet open={open} onClose={onClose} title={edit?“내역 수정”:“개인 내역 추가”}>
<div style={{display:“flex”,gap:6,marginBottom:16,flexWrap:“wrap”}}>
<KBtn label=“지출” active={kind===“expense”} onClick={()=>setKind(“expense”)} color=”#E94F37”/>
<KBtn label=“💰 월급” active={kind===“income_salary”} onClick={()=>setKind(“income_salary”)} color=”#44BBA4”/>
<KBtn label=“🎁 월급 외” active={kind===“income_extra”} onClick={()=>setKind(“income_extra”)} color=”#2D7DD2”/>
<KBtn label=“저축” active={kind===“saving”} onClick={()=>setKind(“saving”)} color=”#8338EC”/>
</div>
{isExp && <>
<div style={{marginBottom:12}}><Lbl>어디서?</Lbl><div style={{display:“flex”,gap:8}}><KBtn label=“💰 월급에서” active={source===“salary”} onClick={()=>setSource(“salary”)} color=”#E94F37”/><KBtn label=“🎁 월급 외” active={source===“extra”} onClick={()=>setSource(“extra”)} color=”#2D7DD2”/></div></div>
<button onClick={()=>setShared(!isShared)} style={{width:“100%”,padding:“9px”,borderRadius:12,border:“2px solid”,borderColor:isShared?”#2D7DD2”:”#E8ECF0”,background:isShared?”#EEF6FF”:”#fff”,color:isShared?”#2D7DD2”:”#bbb”,fontWeight:700,fontSize:13,cursor:“pointer”,marginBottom:12}}>{isShared?“💑 공유 지출로 집계됨”:“공유 지출로 표시하기”}</button>
</>}
<div style={{marginBottom:12}}><Lbl>금액</Lbl><Inp type=“number” value={amount} placeholder=“0” onChange={e=>setAmt(e.target.value)} style={{fontSize:20,fontWeight:700}}/></div>
<div style={{marginBottom:12}}><Lbl>카테고리</Lbl><div style={{display:“flex”,flexWrap:“wrap”,gap:6}}>{cats.map(c=><button key={c} onClick={()=>setCat(c)} style={{padding:“6px 11px”,borderRadius:20,border:“none”,cursor:“pointer”,background:cat===c?kColor:”#F0F2F5”,color:cat===c?”#fff”:”#666”,fontSize:12,fontWeight:600}}>{c}</button>)}</div></div>
<div style={{marginBottom:12}}><Lbl>날짜</Lbl><Inp type=“date” value={date} onChange={e=>setDate(e.target.value)}/></div>
<div style={{marginBottom:20}}><Lbl>메모</Lbl><Inp value={memo} placeholder=“메모 (선택)” onChange={e=>setMemo(e.target.value)}/></div>
<div style={{display:“flex”,gap:10}}><ActionBtn outline color="#AAB0BC" onClick={onClose} style={{flex:1}}>취소</ActionBtn><ActionBtn color={kColor} onClick={save} style={{flex:2}}>저장</ActionBtn></div>
</BottomSheet>
);
}

// ─── Shared Entry Modal ───────────────────────────────────────
function SharedModal({open,onClose,onSave,edit}) {
const [eventType,setEvent]=useState(edit?.eventType||“daily”);
const [amount,setAmt]=useState(edit?.amount||””);
const [cat,setCat]=useState(edit?.cat||SHARED_DAILY_CATS[0]);
const [memo,setMemo]=useState(edit?.memo||””);
const [date,setDate]=useState(edit?.date||todayStr());
useEffect(()=>{ if(!edit) setCat(eventType===“daily”?SHARED_DAILY_CATS[0]:SHARED_EVENT_CATS[0]); },[eventType]);
if(!open) return null;
const color=eventType===“daily”?”#2D7DD2”:”#F26419”;
function save(){ const n=Number(amount); if(!n||n<=0) return; onSave({id:edit?.id||uid(),eventType,amount:n,cat,memo,date,source:“direct”}); onClose(); }
return (
<BottomSheet open={open} onClose={onClose} title={edit?“공유 지출 수정”:“공유 지출 추가”}>
<div style={{display:“flex”,gap:8,marginBottom:16}}><KBtn label=“🗓️ 일상” active={eventType===“daily”} onClick={()=>setEvent(“daily”)} color=”#2D7DD2”/><KBtn label=“🎉 이벤트” active={eventType===“event”} onClick={()=>setEvent(“event”)} color=”#F26419”/></div>
<div style={{marginBottom:12}}><Lbl>금액</Lbl><Inp type=“number” value={amount} placeholder=“0” onChange={e=>setAmt(e.target.value)} style={{fontSize:20,fontWeight:700}}/></div>
<div style={{marginBottom:12}}><Lbl>카테고리</Lbl><div style={{display:“flex”,flexWrap:“wrap”,gap:6}}>{(eventType===“daily”?SHARED_DAILY_CATS:SHARED_EVENT_CATS).map(c=><button key={c} onClick={()=>setCat(c)} style={{padding:“6px 11px”,borderRadius:20,border:“none”,cursor:“pointer”,background:cat===c?color:”#F0F2F5”,color:cat===c?”#fff”:”#666”,fontSize:12,fontWeight:600}}>{c}</button>)}</div></div>
<div style={{marginBottom:12}}><Lbl>날짜</Lbl><Inp type=“date” value={date} onChange={e=>setDate(e.target.value)}/></div>
<div style={{marginBottom:20}}><Lbl>메모</Lbl><Inp value={memo} placeholder=“메모 (선택)” onChange={e=>setMemo(e.target.value)}/></div>
<div style={{display:“flex”,gap:10}}><ActionBtn outline color="#AAB0BC" onClick={onClose} style={{flex:1}}>취소</ActionBtn><ActionBtn color={color} onClick={save} style={{flex:2}}>저장</ActionBtn></div>
</BottomSheet>
);
}

// ─── Recurring Modal ──────────────────────────────────────────
function RecurringModal({open,onClose,recurring,onSave}) {
const [items,setItems]=useState(recurring||[]);
const [form,setForm]=useState(null);
function startNew(){ setForm({id:uid(),name:””,amount:””,cat:PERSONAL_EXPENSE_CATS[0],day:1,tab:“personal”,source:“salary”,isShared:false,eventType:“daily”,active:true}); }
function saveForm(){ if(!form.name||!form.amount) return; setItems(prev=>{ const i=prev.findIndex(r=>r.id===form.id); if(i>=0){const n=[…prev];n[i]=form;return n;} return […prev,form]; }); setForm(null); }
function del(id){ setItems(prev=>prev.filter(r=>r.id!==id)); }
if(!open) return null;
const cats=form?.tab===“personal”?PERSONAL_EXPENSE_CATS:form?.eventType===“event”?SHARED_EVENT_CATS:SHARED_DAILY_CATS;
return (
<BottomSheet open={open} onClose={()=>{setForm(null);onClose();}} title={form?“정기 지출 설정”:“🔁 정기 지출 관리”}>
{!form ? (
<>
{items.length===0&&<div style={{textAlign:“center”,padding:“24px 0”,color:”#C0C6D0”,fontSize:14}}>등록된 정기 지출이 없어요</div>}
{items.map(r=>(
<div key={r.id} style={{display:“flex”,alignItems:“center”,gap:10,padding:“12px 0”,borderBottom:“1px solid #F0F2F5”}}>
<div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{r.name}</div><div style={{fontSize:12,color:”#aaa”,marginTop:2}}>매월 {r.day}일 · {fmt(r.amount)} · {r.tab===“personal”?“개인”:“공유”}</div></div>
<button onClick={()=>setForm({…r})} style={{background:“none”,border:“none”,cursor:“pointer”,fontSize:13,color:”#aaa”}}>✏️</button>
<button onClick={()=>del(r.id)} style={{background:“none”,border:“none”,cursor:“pointer”,fontSize:13,color:”#aaa”}}>🗑️</button>
<div style={{width:36,height:20,borderRadius:10,background:r.active?”#44BBA4”:”#E0E4EA”,cursor:“pointer”,position:“relative”}} onClick={()=>setItems(prev=>prev.map(x=>x.id===r.id?{…x,active:!x.active}:x))}>
<div style={{position:“absolute”,top:2,left:r.active?18:2,width:16,height:16,borderRadius:8,background:”#fff”,transition:“left .2s”}}/>
</div>
</div>
))}
<div style={{marginTop:16,display:“flex”,gap:10}}>
<ActionBtn outline color=”#AAB0BC” onClick={()=>{onSave(items);onClose();}} style={{flex:1}}>저장 후 닫기</ActionBtn>
<ActionBtn color="#1A1D23" onClick={startNew} style={{flex:2}}>+ 새 정기 지출</ActionBtn>
</div>
</>
) : (
<>
<div style={{marginBottom:12}}><Lbl>이름</Lbl><Inp value={form.name} placeholder=“예: 월세, 넷플릭스” onChange={e=>setForm(p=>({…p,name:e.target.value}))}/></div>
<div style={{marginBottom:12}}><Lbl>금액</Lbl><Inp type=“number” value={form.amount} placeholder=“0” onChange={e=>setForm(p=>({…p,amount:Number(e.target.value)}))} style={{fontSize:18,fontWeight:700}}/></div>
<div style={{marginBottom:12}}><Lbl>매월 몇 일?</Lbl><Inp type=“number” min={1} max={31} value={form.day} onChange={e=>setForm(p=>({…p,day:Number(e.target.value)}))}/></div>
<div style={{marginBottom:12}}><Lbl>어느 가계부?</Lbl><div style={{display:“flex”,gap:8}}><KBtn label=“👤 개인” active={form.tab===“personal”} onClick={()=>setForm(p=>({…p,tab:“personal”}))} color=”#1A1D23”/><KBtn label=“💑 공유” active={form.tab===“shared”} onClick={()=>setForm(p=>({…p,tab:“shared”}))} color=”#2D7DD2”/></div></div>
{form.tab===“personal”&&<>
<div style={{marginBottom:12}}><Lbl>어디서?</Lbl><div style={{display:“flex”,gap:8}}><KBtn label=“💰 월급” active={form.source===“salary”} onClick={()=>setForm(p=>({…p,source:“salary”}))} color=”#E94F37”/><KBtn label=“🎁 월급 외” active={form.source===“extra”} onClick={()=>setForm(p=>({…p,source:“extra”}))} color=”#2D7DD2”/></div></div>
<button onClick={()=>setForm(p=>({…p,isShared:!p.isShared}))} style={{width:“100%”,padding:“9px”,borderRadius:12,border:“2px solid”,borderColor:form.isShared?”#2D7DD2”:”#E8ECF0”,background:form.isShared?”#EEF6FF”:”#fff”,color:form.isShared?”#2D7DD2”:”#bbb”,fontWeight:700,fontSize:13,cursor:“pointer”,marginBottom:12}}>{form.isShared?“💑 공유로 집계”:“공유 지출로 표시”}</button>
</>}
{form.tab===“shared”&&<div style={{marginBottom:12}}><Lbl>지출 유형</Lbl><div style={{display:“flex”,gap:8}}><KBtn label=“🗓️ 일상” active={form.eventType===“daily”} onClick={()=>setForm(p=>({…p,eventType:“daily”}))} color=”#2D7DD2”/><KBtn label=“🎉 이벤트” active={form.eventType===“event”} onClick={()=>setForm(p=>({…p,eventType:“event”}))} color=”#F26419”/></div></div>}
<div style={{marginBottom:16}}><Lbl>카테고리</Lbl><div style={{display:“flex”,flexWrap:“wrap”,gap:6}}>{cats.map(c=><button key={c} onClick={()=>setForm(p=>({…p,cat:c}))} style={{padding:“6px 11px”,borderRadius:20,border:“none”,cursor:“pointer”,background:form.cat===c?”#1A1D23”:”#F0F2F5”,color:form.cat===c?”#fff”:”#666”,fontSize:12,fontWeight:600}}>{c}</button>)}</div></div>
<div style={{display:“flex”,gap:10}}><ActionBtn outline color=”#AAB0BC” onClick={()=>setForm(null)} style={{flex:1}}>취소</ActionBtn><ActionBtn color="#1A1D23" onClick={saveForm} style={{flex:2}}>저장</ActionBtn></div>
</>
)}
</BottomSheet>
);
}

// ─── Budget Modal ─────────────────────────────────────────────
function BudgetModal({open,onClose,budgets,onSave}) {
const [vals,setVals]=useState({…budgets});
if(!open) return null;
return (
<BottomSheet open={open} onClose={onClose} title="공유 예산 설정">
{[[“monthly_daily”,“🗓️ 월 일상 지출 목표”],[“monthly_event”,“🎉 월 이벤트 지출 목표”],[“annual_total”,“📅 연간 총 지출 목표”]].map(([k,l])=>(
<div key={k} style={{marginBottom:14}}><Lbl>{l}</Lbl><Inp type=“number” value={vals[k]||””} placeholder=“목표 없음” onChange={e=>setVals(p=>({…p,[k]:e.target.value?Number(e.target.value):””}))} /></div>
))}
<div style={{display:“flex”,gap:10,marginTop:8}}><ActionBtn outline color="#AAB0BC" onClick={onClose} style={{flex:1}}>취소</ActionBtn><ActionBtn color=”#2D7DD2” onClick={()=>{onSave(vals);onClose();}} style={{flex:2}}>저장</ActionBtn></div>
</BottomSheet>
);
}

// ─── Excel Export ─────────────────────────────────────────────
function exportExcel(personal, shared, month) {
const wb=XLSX.utils.book_new();
const pRows=personal.filter(e=>!month||monthOf(e.date)===month).map(e=>({날짜:e.date,구분:e.kind===“expense”?“지출”:e.kind===“income_salary”?“월급”:e.kind===“income_extra”?“월급외수입”:“저축”,금액:e.amount,카테고리:e.cat,재원:e.source===“extra”?“월급외”:“월급”,공유:e.isShared?“공유”:“개인”,메모:e.memo||””}));
const sRows=shared.filter(e=>!month||monthOf(e.date)===month).map(e=>({날짜:e.date,유형:e.eventType===“event”?“이벤트”:“일상”,금액:e.amount,카테고리:e.cat,출처:e.source===“personal”?“개인에서”:“직접”,메모:e.memo||””}));
if(pRows.length) XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(pRows),“개인 내역”);
if(sRows.length) XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(sRows),“공유 내역”);
const label=month?month.replace(”-”,“년 “)+“월”:“전체”;
XLSX.writeFile(wb,`가계부_${label}.xlsx`);
}

// ─── List Components ──────────────────────────────────────────
function PersonalList({entries,onEdit,onDelete}) {
if(!entries.length) return <div style={{textAlign:“center”,padding:“40px 0”,color:”#C0C6D0”}}><div style={{fontSize:36,marginBottom:8}}>📭</div><div style={{fontSize:14}}>이번달 내역이 없어요</div></div>;
const kColor=k=>k===“expense”?”#E94F37”:k===“saving”?”#8338EC”:”#44BBA4”;
const kSign=k=>k===“expense”?”-”:k===“saving”?“→”:”+”;
return <div>{entries.map(e=>(
<div key={e.id} style={{display:“flex”,alignItems:“center”,gap:12,padding:“11px 0”,borderBottom:“1px solid #F0F2F5”}}>
<div style={{width:42,height:42,borderRadius:14,background:`${kColor(e.kind)}12`,display:“flex”,alignItems:“center”,justifyContent:“center”,fontSize:18,flexShrink:0}}>{e.cat.split(” “)[0]}</div>
<div style={{flex:1,minWidth:0}}>
<div style={{fontWeight:600,fontSize:14,color:”#1A1D23”,display:“flex”,alignItems:“center”,gap:5,flexWrap:“wrap”}}>
{e.cat.split(” “).slice(1).join(” “)||e.cat}
{e.isRecurring&&<span style={{fontSize:10,color:”#8338EC”,background:”#F3EEFF”,padding:“1px 6px”,borderRadius:8}}>🔁</span>}
{e.kind===“expense”&&e.source===“extra”&&<span style={{fontSize:10,color:”#2D7DD2”,background:”#EEF6FF”,padding:“1px 6px”,borderRadius:8}}>월급외</span>}
{e.kind===“expense”&&e.isShared&&<span style={{fontSize:10,color:”#F26419”,background:”#FFF3EE”,padding:“1px 6px”,borderRadius:8}}>💑공유</span>}
{e.kind===“income_salary”&&<span style={{fontSize:10,color:”#44BBA4”,background:”#EDFAF6”,padding:“1px 6px”,borderRadius:8}}>월급</span>}
{e.kind===“income_extra”&&<span style={{fontSize:10,color:”#2D7DD2”,background:”#EEF6FF”,padding:“1px 6px”,borderRadius:8}}>월급외</span>}
</div>
<div style={{fontSize:12,color:”#C0C6D0”,marginTop:2}}>{e.date.slice(5)}{e.memo&&` · ${e.memo}`}</div>
</div>
<div style={{textAlign:“right”}}>
<div style={{fontWeight:700,fontSize:15,color:kColor(e.kind)}}>{kSign(e.kind)}{fmt(e.amount)}</div>
{!e.isRecurring&&<div style={{display:“flex”,gap:4,marginTop:4,justifyContent:“flex-end”}}><button onClick={()=>onEdit(e)} style={{background:“none”,border:“none”,cursor:“pointer”,fontSize:13,color:”#C0C6D0”}}>✏️</button><button onClick={()=>onDelete(e.id)} style={{background:“none”,border:“none”,cursor:“pointer”,fontSize:13,color:”#C0C6D0”}}>🗑️</button></div>}
</div>
</div>
))}</div>;
}

function SharedList({entries,onEdit,onDelete}) {
if(!entries.length) return <div style={{textAlign:“center”,padding:“40px 0”,color:”#C0C6D0”}}><div style={{fontSize:36,marginBottom:8}}>📭</div><div style={{fontSize:14}}>이번달 공유 지출이 없어요</div></div>;
return <div>{entries.map(e=>{
const isEvent=e.eventType===“event”; const color=isEvent?”#F26419”:”#2D7DD2”; const fromP=e.source===“personal”;
return (
<div key={e.id} style={{display:“flex”,alignItems:“center”,gap:12,padding:“11px 0”,borderBottom:“1px solid #F0F2F5”}}>
<div style={{width:42,height:42,borderRadius:14,background:`${color}12`,display:“flex”,alignItems:“center”,justifyContent:“center”,fontSize:18,flexShrink:0}}>{e.cat.split(” “)[0]}</div>
<div style={{flex:1,minWidth:0}}>
<div style={{fontWeight:600,fontSize:14,color:”#1A1D23”,display:“flex”,alignItems:“center”,gap:5,flexWrap:“wrap”}}>
{e.cat.split(” “).slice(1).join(” “)||e.cat}
<span style={{fontSize:10,fontWeight:700,color,background:`${color}15`,padding:“1px 6px”,borderRadius:8}}>{isEvent?“🎉”:“🗓️”}</span>
{e.isRecurring&&<span style={{fontSize:10,color:”#8338EC”,background:”#F3EEFF”,padding:“1px 6px”,borderRadius:8}}>🔁</span>}
{fromP&&<span style={{fontSize:10,color:”#aaa”,background:”#F5F5F5”,padding:“1px 6px”,borderRadius:8}}>개인에서</span>}
</div>
<div style={{fontSize:12,color:”#C0C6D0”,marginTop:2}}>{e.date.slice(5)}{e.memo&&` · ${e.memo}`}</div>
</div>
<div style={{textAlign:“right”}}>
<div style={{fontWeight:700,fontSize:15,color}}>-{fmt(e.amount)}</div>
{!fromP&&!e.isRecurring&&<div style={{display:“flex”,gap:4,marginTop:4,justifyContent:“flex-end”}}><button onClick={()=>onEdit(e)} style={{background:“none”,border:“none”,cursor:“pointer”,fontSize:13,color:”#C0C6D0”}}>✏️</button><button onClick={()=>onDelete(e.id)} style={{background:“none”,border:“none”,cursor:“pointer”,fontSize:13,color:”#C0C6D0”}}>🗑️</button></div>}
</div>
</div>
);
})}</div>;
}

// ─── Stats ────────────────────────────────────────────────────
function PersonalStats({monthEntries,allEntries,month}) {
const sal=monthEntries.filter(e=>e.kind===“income_salary”).reduce((s,e)=>s+e.amount,0);
const ext=monthEntries.filter(e=>e.kind===“income_extra”).reduce((s,e)=>s+e.amount,0);
const salExp=monthEntries.filter(e=>e.kind===“expense”&&e.source===“salary”).reduce((s,e)=>s+e.amount,0);
const extExp=monthEntries.filter(e=>e.kind===“expense”&&e.source===“extra”).reduce((s,e)=>s+e.amount,0);
const saving=monthEntries.filter(e=>e.kind===“saving”).reduce((s,e)=>s+e.amount,0);
const sharedAmt=monthEntries.filter(e=>e.kind===“expense”&&e.isShared).reduce((s,e)=>s+e.amount,0);
const catData=useMemo(()=>{ const m={}; monthEntries.filter(e=>e.kind===“expense”).forEach(e=>{ m[e.cat]=(m[e.cat]||0)+e.amount; }); return Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>({cat,amt})); },[monthEntries]);
const trend=useMemo(()=>last6(month).map(mo=>({ name:mo.slice(5)+“월”, 월급:allEntries.filter(e=>monthOf(e.date)===mo&&e.kind===“income_salary”).reduce((s,e)=>s+e.amount,0), 월급외:allEntries.filter(e=>monthOf(e.date)===mo&&e.kind===“income_extra”).reduce((s,e)=>s+e.amount,0), 지출:allEntries.filter(e=>monthOf(e.date)===mo&&e.kind===“expense”).reduce((s,e)=>s+e.amount,0) })),[allEntries,month]);
return (
<div style={{display:“flex”,flexDirection:“column”,gap:14}}>
<Card><SecTitle>💰 수입 구분</SecTitle><div style={{display:“grid”,gridTemplateColumns:“1fr 1fr”,gap:10}}>
<div style={{background:”#EDFAF6”,borderRadius:14,padding:14}}><div style={{fontSize:12,color:”#44BBA4”,fontWeight:700,marginBottom:4}}>월급</div><div style={{fontSize:18,fontWeight:800}}>{fmt(sal)}</div><div style={{fontSize:12,color:”#aaa”,marginTop:4}}>지출 {fmt(salExp)}</div><div style={{fontSize:12,color:”#44BBA4”,fontWeight:700}}>잔액 {fmt(sal-salExp)}</div></div>
<div style={{background:”#EEF6FF”,borderRadius:14,padding:14}}><div style={{fontSize:12,color:”#2D7DD2”,fontWeight:700,marginBottom:4}}>월급 외</div><div style={{fontSize:18,fontWeight:800}}>{fmt(ext)}</div><div style={{fontSize:12,color:”#aaa”,marginTop:4}}>지출 {fmt(extExp)}</div><div style={{fontSize:12,color:”#2D7DD2”,fontWeight:700}}>잔액 {fmt(ext-extExp)}</div></div>
</div></Card>
{sharedAmt>0&&<Card style={{borderLeft:“4px solid #F26419”}}><SecTitle color="#F26419">💑 공유로 낸 금액</SecTitle><div style={{fontSize:24,fontWeight:800,color:”#F26419”}}>{fmt(sharedAmt)}</div></Card>}
{saving>0&&<Card><SecTitle color="#8338EC">🐷 저축/투자</SecTitle><div style={{fontSize:24,fontWeight:800,color:”#8338EC”}}>{fmt(saving)}</div></Card>}
{catData.length>0&&<Card><SecTitle>지출 카테고리</SecTitle><ResponsiveContainer width="100%" height={160}><PieChart><Pie data={catData} dataKey="amt" nameKey="cat" cx="50%" cy="50%" outerRadius={65} paddingAngle={3}>{catData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}</Pie><Tooltip formatter={v=>fmt(v)}/></PieChart></ResponsiveContainer>{catData.slice(0,5).map(({cat,amt},i)=><div key={cat} style={{display:“flex”,alignItems:“center”,gap:8,marginBottom:6}}><div style={{width:10,height:10,borderRadius:3,background:PIE_COLORS[i%PIE_COLORS.length],flexShrink:0}}/><div style={{flex:1,fontSize:13,color:”#555”}}>{cat}</div><div style={{fontWeight:700,fontSize:13}}>{fmt(amt)}</div></div>)}</Card>}
<Card><SecTitle>6개월 추이</SecTitle><ResponsiveContainer width="100%" height={155}><BarChart data={trend} barGap={2}><XAxis dataKey=“name” tick={{fontSize:10,fill:”#AAB0BC”}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip formatter={v=>fmt(v)}/><Bar dataKey="월급" fill="#44BBA4" radius={[4,4,0,0]} maxBarSize={16}/><Bar dataKey="월급외" fill="#2D7DD2" radius={[4,4,0,0]} maxBarSize={16}/><Bar dataKey="지출" fill="#E94F37" radius={[4,4,0,0]} maxBarSize={16}/></BarChart></ResponsiveContainer></Card>
</div>
);
}

function SharedStats({monthEntries,allEntries,month,budgets}) {
const daily=monthEntries.filter(e=>e.eventType===“daily”).reduce((s,e)=>s+e.amount,0);
const event=monthEntries.filter(e=>e.eventType===“event”).reduce((s,e)=>s+e.amount,0);
const past=last6(month).slice(0,-1);
const avgD=past.length?Math.round(past.map(mo=>allEntries.filter(e=>monthOf(e.date)===mo&&e.eventType===“daily”).reduce((s,e)=>s+e.amount,0)).reduce((a,b)=>a+b,0)/past.length):0;
const avgE=past.length?Math.round(past.map(mo=>allEntries.filter(e=>monthOf(e.date)===mo&&e.eventType===“event”).reduce((s,e)=>s+e.amount,0)).reduce((a,b)=>a+b,0)/past.length):0;
const year=yearOf(todayStr()); const annualTotal=allEntries.filter(e=>yearOf(e.date)===year).reduce((s,e)=>s+e.amount,0); const annualGoal=budgets.annual_total||0; const annualPct=annualGoal?Math.round(annualTotal/annualGoal*100):0;
const trend=useMemo(()=>last6(month).map(mo=>({ name:mo.slice(5)+“월”, 일상:allEntries.filter(e=>monthOf(e.date)===mo&&e.eventType===“daily”).reduce((s,e)=>s+e.amount,0), 이벤트:allEntries.filter(e=>monthOf(e.date)===mo&&e.eventType===“event”).reduce((s,e)=>s+e.amount,0) })),[allEntries,month]);
return (
<div style={{display:“flex”,flexDirection:“column”,gap:14}}>
<Card><SecTitle>이달 vs 평균</SecTitle>
{[{l:“🗓️ 일상”,val:daily,avg:avgD,goal:budgets.monthly_daily,c:”#2D7DD2”},{l:“🎉 이벤트”,val:event,avg:avgE,goal:budgets.monthly_event,c:”#F26419”}].map(({l,val,avg,goal,c})=>(
<div key={l} style={{marginBottom:16}}>
<div style={{display:“flex”,justifyContent:“space-between”,marginBottom:5}}><span style={{fontSize:13,fontWeight:700}}>{l}</span><span style={{fontSize:13,fontWeight:800,color:c}}>{fmt(val)}</span></div>
{avg>0&&<div style={{fontSize:12,color:”#aaa”,marginBottom:5}}>평균 {fmt(avg)} 대비 <span style={{fontWeight:700,color:val>avg?”#E94F37”:”#44BBA4”}}>{val>avg?`+${fmt(val-avg)}`:`-${fmt(avg-val)}`}</span></div>}
{goal>0&&<><div style={{background:”#F0F2F5”,borderRadius:6,height:6,overflow:“hidden”}}><div style={{width:`${Math.min(val/goal*100,100)}%`,height:“100%”,background:val>goal?”#E94F37”:c,borderRadius:6}}/></div><div style={{fontSize:11,color:”#aaa”,marginTop:3}}>목표 {fmt(goal)} 중 {Math.round(val/goal*100)}%</div></>}
</div>
))}
</Card>
{annualGoal>0&&<Card><SecTitle>📅 {year}년 연간 목표</SecTitle><div style={{fontSize:12,color:”#aaa”,marginBottom:8}}>누적 {fmt(annualTotal)} / 목표 {fmt(annualGoal)}</div><div style={{background:”#F0F2F5”,borderRadius:8,height:10,overflow:“hidden”,marginBottom:6}}><div style={{width:`${Math.min(annualPct,100)}%`,height:“100%”,background:annualPct>100?”#E94F37”:”#2D7DD2”,borderRadius:8}}/></div><div style={{display:“flex”,justifyContent:“space-between”,fontSize:13}}><span style={{color:annualPct>100?”#E94F37”:”#2D7DD2”,fontWeight:700}}>{annualPct}% 사용</span><span style={{color:”#aaa”}}>남은 {fmt(Math.max(annualGoal-annualTotal,0))}</span></div></Card>}
<Card><SecTitle>6개월 추이</SecTitle><ResponsiveContainer width="100%" height={155}><BarChart data={trend} barGap={4}><XAxis dataKey=“name” tick={{fontSize:10,fill:”#AAB0BC”}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip formatter={v=>fmt(v)}/><Bar dataKey="일상" fill="#2D7DD2" radius={[6,6,0,0]} maxBarSize={22} stackId="a"/><Bar dataKey="이벤트" fill="#F26419" radius={[0,0,0,0]} maxBarSize={22} stackId="a"/></BarChart></ResponsiveContainer></Card>
</div>
);
}

// ─── Headers ──────────────────────────────────────────────────
function PersonalHeader({entries}) {
const sal=entries.filter(e=>e.kind===“income_salary”).reduce((s,e)=>s+e.amount,0);
const ext=entries.filter(e=>e.kind===“income_extra”).reduce((s,e)=>s+e.amount,0);
const exp=entries.filter(e=>e.kind===“expense”).reduce((s,e)=>s+e.amount,0);
const sav=entries.filter(e=>e.kind===“saving”).reduce((s,e)=>s+e.amount,0);
return (
<div style={{background:“linear-gradient(135deg,#1A1D23,#2D3748)”,borderRadius:24,padding:“22px 20px”,color:”#fff”,marginBottom:14,boxShadow:“0 6px 32px rgba(0,0,0,.18)”}}>
<div style={{fontSize:11,opacity:.5,marginBottom:3,letterSpacing:.8}}>이번달 순수지</div>
<div style={{fontSize:30,fontWeight:900,letterSpacing:-1,marginBottom:14}}>{fmt(sal+ext-exp-sav)}</div>
<div style={{display:“grid”,gridTemplateColumns:“1fr 1fr 1fr 1fr”,gap:8}}>
{[{l:“월급”,v:sal,c:”#44BBA4”},{l:“월급외”,v:ext,c:”#2D7DD2”},{l:“지출”,v:exp,c:”#E94F37”},{l:“저축”,v:sav,c:”#8338EC”}].map(({l,v,c})=>(
<div key={l} style={{background:“rgba(255,255,255,.08)”,borderRadius:10,padding:“8px 10px”}}>
<div style={{fontSize:10,opacity:.6,marginBottom:2}}>{l}</div>
<div style={{fontSize:12,fontWeight:800,color:c}}>{fmt(v)}</div>
</div>
))}
</div>
</div>
);
}

function SharedHeader({entries}) {
const daily=entries.filter(e=>e.eventType===“daily”).reduce((s,e)=>s+e.amount,0);
const event=entries.filter(e=>e.eventType===“event”).reduce((s,e)=>s+e.amount,0);
return (
<div style={{background:“linear-gradient(135deg,#1a3a5c,#2D7DD2)”,borderRadius:24,padding:“22px 20px”,color:”#fff”,marginBottom:14,boxShadow:“0 6px 32px rgba(45,125,210,.25)”}}>
<div style={{fontSize:11,opacity:.5,marginBottom:3,letterSpacing:.8}}>이번달 함께 쓴 돈</div>
<div style={{fontSize:30,fontWeight:900,letterSpacing:-1,marginBottom:14}}>{fmt(daily+event)}</div>
<div style={{display:“grid”,gridTemplateColumns:“1fr 1fr”,gap:10}}>
{[{l:“🗓️ 일상”,v:daily,c:”#93D7FF”},{l:“🎉 이벤트”,v:event,c:”#FFB347”}].map(({l,v,c})=>(
<div key={l} style={{background:“rgba(255,255,255,.12)”,borderRadius:12,padding:“10px 14px”}}>
<div style={{fontSize:11,opacity:.7,marginBottom:2}}>{l}</div>
<div style={{fontSize:16,fontWeight:800,color:c}}>{fmt(v)}</div>
</div>
))}
</div>
</div>
);
}

function SyncBadge({status}) {
const m={synced:{c:”#44BBA4”,t:“✓ 동기화됨”},syncing:{c:”#F26419”,t:“⟳ 동기화 중”},error:{c:”#E94F37”,t:“✗ 오류”}};
const {c,t}=m[status]||m.synced;
return <span style={{fontSize:11,fontWeight:700,color:c,background:`${c}18`,padding:“3px 10px”,borderRadius:20}}>{t}</span>;
}

// ─── Main App ─────────────────────────────────────────────────
export default function App() {
const [myName,setMyName]     = useLS(“cb_name_v1”,””);
const [mainTab,setMain]      = useState(“personal”);
const [subTab,setSub]        = useState(“list”);
const [month,setMonth]       = useState(todayStr().slice(0,7));
const [pModal,setPModal]     = useState(false);
const [sModal,setSModal]     = useState(false);
const [bModal,setBModal]     = useState(false);
const [rModal,setRModal]     = useState(false);
const [ocrModal,setOCR]      = useState(false);
const [editItem,setEdit]     = useState(null);
const [syncStatus,setSync]   = useState(“synced”);
const [menuOpen,setMenu]     = useState(false);

const [personal,setPersonal]       = useLS(“cb_personal_v4”,[]);
const [sharedCloud,setSharedCloud] = useState([]);
const [budgets,setBudgets]         = useLS(“cb_budgets_v4”,{});
const [recurring,setRecurring]     = useLS(“cb_recurring_v1”,[]);

useEffect(()=>{ loadShared(); const t=setInterval(loadShared,30000); return()=>clearInterval(t); },[]);

async function loadShared(){ setSync(“syncing”); const d=await cloudLoad(); setSharedCloud(d); setSync(“synced”); }
async function saveShared(data){ setSync(“syncing”); await cloudSave(data); setSync(“synced”); }

// Apply recurring
useEffect(()=>{
if(!recurring.length) return;
const days=daysInMonth(month);
const toAdd=[];
recurring.filter(r=>r.active).forEach(r=>{
const day=Math.min(r.day,days);
const date=`${month}-${String(day).padStart(2,"0")}`;
const rid=`rec_${r.id}_${month}`;
if(r.tab===“personal”){ if(!personal.find(e=>e.id===rid)) toAdd.push({id:rid,kind:“expense”,amount:r.amount,cat:r.cat,memo:r.name,date,source:r.source,isShared:r.isShared,isRecurring:true}); }
else { if(!sharedCloud.find(e=>e.id===rid)){ const next=[…sharedCloud,{id:rid,eventType:r.eventType,amount:r.amount,cat:r.cat,memo:r.name,date,source:“direct”,isRecurring:true}]; setSharedCloud(next); saveShared(next); } }
});
if(toAdd.length) setPersonal(prev=>[…prev,…toAdd]);
},[recurring,month]);

const sharedFromPersonal=useMemo(()=>personal.filter(e=>e.kind===“expense”&&e.isShared).map(e=>({id:“p_”+e.id,eventType:“daily”,amount:e.amount,cat:e.cat,memo:e.memo,date:e.date,source:“personal”})),[personal]);
const allShared=useMemo(()=>[…sharedCloud,…sharedFromPersonal].sort((a,b)=>b.date.localeCompare(a.date)),[sharedCloud,sharedFromPersonal]);

function savePersonal(item){ setPersonal(prev=>{ const i=prev.findIndex(e=>e.id===item.id); if(i>=0){const n=[…prev];n[i]=item;return n;} return [item,…prev]; }); }
function delPersonal(id){ setPersonal(prev=>prev.filter(e=>e.id!==id)); }
function saveSharedEntry(item){ const next=(()=>{ const i=sharedCloud.findIndex(e=>e.id===item.id); if(i>=0){const n=[…sharedCloud];n[i]=item;return n;} return [item,…sharedCloud]; })(); setSharedCloud(next); saveShared(next); }
function delSharedEntry(id){ const next=sharedCloud.filter(e=>e.id!==id); setSharedCloud(next); saveShared(next); }

function handleOCRImport(items){
const toP=[],toS=[];
items.forEach(item=>{
if(item.tab===“personal”) toP.push({id:item.id,kind:“expense”,amount:item.amount,cat:item.cat,memo:item.memo||item.rawName,date:item.date,source:item.source,isShared:item.isShared});
else toS.push({id:item.id,eventType:item.eventType,amount:item.amount,cat:item.cat,memo:item.memo||item.rawName,date:item.date,source:“direct”});
});
if(toP.length) setPersonal(prev=>[…toP,…prev]);
if(toS.length){ const next=[…toS,…sharedCloud]; setSharedCloud(next); saveShared(next); }
}

const isPersonal=mainTab===“personal”;
const curEntries=isPersonal?personal:allShared;
const monthEntries=useMemo(()=>curEntries.filter(e=>monthOf(e.date)===month).sort((a,b)=>b.date.localeCompare(a.date)),[curEntries,month]);

if(!myName) return <SetupScreen onDone={n=>setMyName(n)}/>;

return (
<div style={{minHeight:“100vh”,background:”#F5F7FA”,fontFamily:”‘Noto Sans KR’,‘Apple SD Gothic Neo’,sans-serif”,display:“flex”,flexDirection:“column”,alignItems:“center”}}>
<div style={{width:“100%”,maxWidth:520,paddingBottom:100}}>
<div style={{padding:“22px 20px 0”,display:“flex”,alignItems:“center”,justifyContent:“space-between”}}>
<div>
<div style={{fontSize:20,fontWeight:900,color:”#1A1D23”,letterSpacing:-.5}}>가계부 💳</div>
<div style={{fontSize:12,color:”#AAB0BC”,marginTop:2,display:“flex”,alignItems:“center”,gap:6}}>{myName}님 {!isPersonal&&<SyncBadge status={syncStatus}/>}</div>
</div>
<div style={{position:“relative”}}>
<button onClick={()=>setMenu(!menuOpen)} style={{background:”#fff”,border:“1.5px solid #E0E4EA”,borderRadius:12,padding:“8px 14px”,fontSize:13,color:”#555”,fontWeight:700,cursor:“pointer”}}>메뉴 ▾</button>
{menuOpen&&(
<div style={{position:“absolute”,right:0,top:44,background:”#fff”,borderRadius:16,boxShadow:“0 8px 32px rgba(0,0,0,.15)”,padding:“8px”,zIndex:100,minWidth:200}} onClick={()=>setMenu(false)}>
{[
{label:“🔁 정기 지출 관리”,fn:()=>setRModal(true)},
{label:“📸 카드 내역 가져오기”,fn:()=>setOCR(true)},
{label:“📊 엑셀 (이번달)”,fn:()=>exportExcel(personal,allShared,month)},
{label:“📊 엑셀 (전체)”,fn:()=>exportExcel(personal,allShared,””)},
{label:“🎯 예산 설정”,fn:()=>setBModal(true)},
{label:“↻ 공유 동기화”,fn:loadShared},
].map(({label,fn})=>(
<button key={label} onClick={fn} style={{display:“block”,width:“100%”,padding:“10px 14px”,borderRadius:10,border:“none”,background:“none”,textAlign:“left”,fontSize:13,fontWeight:600,color:”#333”,cursor:“pointer”}}>{label}</button>
))}
</div>
)}
</div>
</div>

```
    <div style={{padding:"14px 20px 0",display:"flex",gap:8}}>
      <button onClick={()=>setMain("personal")} style={{flex:1,padding:"11px 0",borderRadius:14,border:"none",cursor:"pointer",background:isPersonal?"#1A1D23":"#fff",color:isPersonal?"#fff":"#AAB0BC",fontWeight:700,fontSize:14,boxShadow:isPersonal?"0 4px 16px rgba(0,0,0,.15)":"none"}}>👤 개인</button>
      <button onClick={()=>setMain("shared")} style={{flex:1,padding:"11px 0",borderRadius:14,border:"none",cursor:"pointer",background:!isPersonal?"#1A1D23":"#fff",color:!isPersonal?"#fff":"#AAB0BC",fontWeight:700,fontSize:14,boxShadow:!isPersonal?"0 4px 16px rgba(0,0,0,.15)":"none"}}>💑 공유</button>
    </div>

    {!isPersonal&&<div style={{margin:"10px 20px 0",background:"#EEF6FF",borderRadius:14,padding:"10px 14px",fontSize:12,color:"#2D7DD2",fontWeight:600}}>💡 같은 링크를 공유하면 함께 입력 가능 · 30초마다 자동 동기화</div>}

    <div style={{padding:"14px 20px 0"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:20,marginBottom:14}}>
        <button onClick={()=>setMonth(prevM(month))} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#555"}}>‹</button>
        <span style={{fontWeight:700,fontSize:15,color:"#1A1D23",minWidth:100,textAlign:"center"}}>{monthLabel(month)}</span>
        <button onClick={()=>setMonth(nextM(month))} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#555"}}>›</button>
      </div>

      {isPersonal?<PersonalHeader entries={monthEntries}/>:<SharedHeader entries={monthEntries}/>}

      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button onClick={()=>setSub("list")} style={{flex:1,padding:"9px 0",borderRadius:12,border:"none",cursor:"pointer",background:subTab==="list"?"#2D7DD2":"#fff",color:subTab==="list"?"#fff":"#AAB0BC",fontWeight:700,fontSize:13}}>📋 내역</button>
        <button onClick={()=>setSub("stats")} style={{flex:1,padding:"9px 0",borderRadius:12,border:"none",cursor:"pointer",background:subTab==="stats"?"#2D7DD2":"#fff",color:subTab==="stats"?"#fff":"#AAB0BC",fontWeight:700,fontSize:13}}>📊 통계</button>
      </div>

      <Card>
        {subTab==="list"
          ? isPersonal
            ? <PersonalList entries={monthEntries} onEdit={e=>{setEdit(e);setPModal(true);}} onDelete={delPersonal}/>
            : <SharedList entries={monthEntries} onEdit={e=>{setEdit(e);setSModal(true);}} onDelete={delSharedEntry}/>
          : isPersonal
            ? <PersonalStats monthEntries={monthEntries} allEntries={personal} month={month}/>
            : <SharedStats monthEntries={monthEntries} allEntries={allShared} month={month} budgets={budgets}/>
        }
      </Card>
    </div>
  </div>

  <button onClick={()=>{ setEdit(null); isPersonal?setPModal(true):setSModal(true); }} style={{position:"fixed",bottom:28,right:"calc(50% - 240px)",width:56,height:56,borderRadius:"50%",border:"none",background:"#1A1D23",color:"#fff",fontSize:26,cursor:"pointer",boxShadow:"0 4px 24px rgba(0,0,0,.25)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50}}>+</button>

  <PersonalModal open={pModal} onClose={()=>{setPModal(false);setEdit(null);}} onSave={savePersonal} edit={editItem}/>
  <SharedModal   open={sModal} onClose={()=>{setSModal(false);setEdit(null);}} onSave={saveSharedEntry} edit={editItem}/>
  <BudgetModal   open={bModal} onClose={()=>setBModal(false)} budgets={budgets} onSave={setBudgets}/>
  <RecurringModal open={rModal} onClose={()=>setRModal(false)} recurring={recurring} onSave={r=>setRecurring(r)}/>
  <CardOCRModal  open={ocrModal} onClose={()=>setOCR(false)} onImport={handleOCRImport}/>
</div>
```

);
}
