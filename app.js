/* ProjectFlow Pro — application connectée Supabase uniquement. Aucun mode démo. */
const CONFIG = window.PROJECTFLOW_SUPABASE || {};
const ROLES = ["membre","chef_projet","gestionnaire_portfolio","directeur_programme","pmo","admin"];
const ROLE_LABEL = {membre:"Membre",chef_projet:"Chef de projet",gestionnaire_portfolio:"Gestionnaire de portfolio",directeur_programme:"Directeur de programme",pmo:"PMO",admin:"Administrateur"};
const NAV = [["dashboard","Pilotage"],["portfolio","Portefeuille"],["program","Programme"],["project","Projet"],["planning","Planning"],["kanban","Kanban"],["workload","Charge"],["budget","Budget"],["risks","Risques"],["governance","Gouvernance"],["reports","Reporting"],["admin","Admin"]];
const TABLES = ["portfolios","programs","projects","tasks","milestones","risks","decisions","actions","resources","audit","comments","views","profiles"];
const state = {db:null,user:null,profile:null,role:"membre",view:"dashboard",projectId:null,data:emptyData(),search:""};
const $ = s => document.querySelector(s);
const uid = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
const today = () => new Date().toISOString().slice(0,10);
const daysBetween=(a,b)=>Math.ceil((new Date(b)-new Date(a))/86400000)||1;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function emptyData(){return {portfolios:[],programs:[],projects:[],tasks:[],milestones:[],risks:[],decisions:[],actions:[],resources:[],audit:[],comments:[],views:[],profiles:[]};}
function toast(msg){const t=$("#toast"); t.textContent=msg; t.style.display="block"; setTimeout(()=>t.style.display="none",2600);}
function money(n){return `${Math.round(Number(n||0)/1000)} k€`;}
function configured(){return Boolean(CONFIG.url && CONFIG.anonKey && !CONFIG.demoMode);}
function can(action){
 const r=state.role;
 const rules={
  contribute:["membre","chef_projet","gestionnaire_portfolio","directeur_programme","pmo","admin"],
  projectManage:["chef_projet","directeur_programme","pmo","admin"],
  portfolio:["gestionnaire_portfolio","directeur_programme","pmo","admin"],
  governance:["directeur_programme","pmo","admin"],
  report:["chef_projet","gestionnaire_portfolio","directeur_programme","pmo","admin"],
  admin:["admin"]
 };
 return (rules[action]||[]).includes(r);
}
async function boot(){
 if(!configured()) return renderAuth("Supabase n'est pas configuré. Renseigne supabase-config.js avec ton URL et anon key.");
 state.db = window.supabase.createClient(CONFIG.url, CONFIG.anonKey);
 const {data:{session}} = await state.db.auth.getSession();
 state.db.auth.onAuthStateChange((_event, session)=>{ if(!session){state.user=null; state.profile=null; renderAuth();} });
 if(!session) return renderAuth();
 state.user=session.user; await loadAll(); renderApp();
}
async function loadAll(){
 const out=emptyData();
 for(const table of TABLES){
  const {data,error}=await state.db.from(table).select("*");
  if(error && table!=="profiles") console.warn(table,error.message);
  out[table]=data||[];
 }
 state.data=out;
 state.profile=out.profiles.find(p=>p.id===state.user.id) || {id:state.user.id,email:state.user.email,role:"membre",full_name:state.user.email};
 state.role=state.profile.role || "membre";
 if(!state.projectId) state.projectId=state.data.projects[0]?.id || null;
}
async function persist(table,row){
 const {error}=await state.db.from(table).upsert(row).select().single();
 if(error){toast(error.message); throw error;}
 await audit(`${table}_upsert`, row.name || row.title || row.id, false);
}
async function audit(type,label,reload=true){
 const row={id:uid(),type,label,user_email:state.user?.email||"",at:new Date().toISOString()};
 await state.db.from("audit").insert(row);
 state.data.audit.push(row);
 if(reload) render();
}
function renderAuth(error=""){
 $("#appShell").classList.add("hidden");
 $("#authWall").classList.remove("hidden");
 $("#authWall").innerHTML=`<section class="auth-card">
  <div class="auth-panel">
   <p class="eyebrow">ProjectFlow Pro</p>
   <h1>Connecte-toi à ton espace projet</h1>
   <p class="muted">Accès sécurisé via Supabase Auth. Les données sont lues et écrites uniquement en base Postgres avec RLS.</p>
   ${error?`<div class="auth-note red">${error}</div>`:""}
   <form id="loginForm" class="auth-form">
    <input id="email" type="email" autocomplete="email" placeholder="email professionnel" required />
    <input id="password" type="password" autocomplete="current-password" placeholder="mot de passe" required />
    <button type="submit">Se connecter</button>
   </form>
   <div class="auth-note muted">Pas de mode démo. Pas de données locales. Si l’utilisateur n’existe pas, crée-le dans Supabase Auth puis affecte son rôle dans <span class="kbd">profiles.role</span>.</div>
  </div>
  <div class="auth-panel">
   <h2>Rôles applicatifs</h2>
   <div class="list">${ROLES.map(r=>`<div class="item between ${r==='admin'?'admin-only':''}"><strong>${ROLE_LABEL[r]}</strong><span class="pill">${r}</span></div>`).join("")}</div>
   <p class="muted">Le PMO pilote la méthode et le reporting. L’admin administre les utilisateurs, référentiels et paramètres.</p>
  </div>
 </section>`;
 $("#loginForm").onsubmit=async e=>{e.preventDefault(); await login();};
}
async function login(){
 const email=$("#email").value.trim(), password=$("#password").value;
 const {data,error}=await state.db.auth.signInWithPassword({email,password});
 if(error) return renderAuth(error.message);
 state.user=data.user; await loadAll(); renderApp();
}
async function logout(){await state.db.auth.signOut(); state.user=null; state.profile=null; renderAuth();}
function renderApp(){
 $("#authWall").classList.add("hidden"); $("#appShell").classList.remove("hidden");
 renderNav(); render();
}
function renderNav(){
 const nav = can("admin") ? NAV : NAV.filter(x=>x[0]!=="admin");
 $("#nav").innerHTML=nav.map(([id,label])=>`<button class="nav-item ${state.view===id?'active':''}" data-nav="${id}"><span>${label}</span></button>`).join("");
 document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>{state.view=b.dataset.nav; render();});
 $("#logoutBtn").onclick=logout;
 $("#exportBtn").onclick=()=>download("reporting-projectflow.csv",toCsv());
 $("#connectionCard").innerHTML=`<strong>${state.profile?.full_name||state.user.email}</strong><br>${state.user.email}<br><span class="pill">${ROLE_LABEL[state.role]||state.role}</span>`;
 const sel=$("#projectSwitcher");
 sel.innerHTML=state.data.projects.length?state.data.projects.map(p=>`<option value="${p.id}">${p.name}</option>`).join(""):`<option>Aucun projet</option>`;
 sel.value=state.projectId||""; sel.disabled=!state.data.projects.length; sel.onchange=()=>{state.projectId=sel.value; render();};
}
function render(){
 if(state.view==="admin"&&!can("admin")) state.view="dashboard";
 renderNav();
 const map={dashboard:renderDashboard,portfolio:renderPortfolio,program:renderProgram,project:renderProject,planning:renderPlanning,kanban:renderKanban,workload:renderWorkload,budget:renderBudget,risks:renderRisks,governance:renderGovernance,reports:renderReports,admin:renderAdmin};
 (map[state.view]||renderDashboard)();
}
function layout(title,html){$("#pageTitle").textContent=title; $("#view").innerHTML=html; document.querySelectorAll("[data-action]").forEach(el=>el.onclick=()=>handleAction(el.dataset.action,el.dataset.id));}
function metric(label,value,sub=""){return `<div class="card span-3"><div class="muted">${label}</div><div class="metric">${value}</div><small class="muted">${sub}</small></div>`;}
function activeProject(){return state.data.projects.find(p=>p.id===state.projectId)||state.data.projects[0]||null;}
function projectTasks(pid=activeProject()?.id){return state.data.tasks.filter(t=>t.project_id===pid);}
function projectRisks(pid=activeProject()?.id){return state.data.risks.filter(r=>r.project_id===pid);}
function kpis(){
 const ps=state.data.projects, ts=state.data.tasks, risks=state.data.risks;
 const budget=ps.reduce((s,p)=>s+Number(p.budget||0),0), spent=ps.reduce((s,p)=>s+Number(p.spent||0),0);
 const progress=Math.round(ps.reduce((s,p)=>s+Number(p.progress||0),0)/Math.max(ps.length,1));
 const late=ts.filter(t=>t.status!=="done"&&new Date(t.end)<new Date()).length;
 const highRisks=risks.filter(r=>Number(r.probability||0)*Number(r.impact||0)>=12).length;
 return {projects:ps.length,tasks:ts.length,budget,spent,progress,late,highRisks};
}
function rag(p){const burn=Number(p.spent||0)/Math.max(Number(p.budget||1),1); if(p.rag) return p.rag; if(burn>.9&&Number(p.progress||0)<75)return"red"; if(burn>.65||Number(p.progress||0)<35)return"amber"; return"green";}
function empty(label,cta=""){return `<div class="empty-state"><h2>${label}</h2>${cta}</div>`;}
function renderDashboard(){const k=kpis(); layout("Pilotage consolidé",`<div class="grid">${metric("Avancement moyen",k.progress+"%","portefeuille")}${metric("Budget consommé",money(k.spent),`sur ${money(k.budget)}`)}${metric("Risques élevés",k.highRisks,"score ≥ 12")}${metric("Tâches en retard",k.late,"hors terminé")}
 <div class="card span-8"><div class="between"><h2>Portefeuille projets</h2>${can('portfolio')?'<button data-action="addProject">Nouveau projet</button>':''}</div>${state.data.projects.length?projectTable():empty("Aucun projet en base",can('portfolio')?'<button data-action="addProject">Créer le premier projet</button>':'')}</div>
 <div class="card span-4"><h2>Alertes</h2><div class="list">${alerts().map(a=>`<div class="item"><span class="status ${a.level}">${a.type}</span><p>${a.text}</p></div>`).join("")||'<p class="muted">Aucune alerte active.</p>'}</div></div>
 <div class="card span-6"><h2>Décisions en attente</h2>${state.data.decisions.filter(d=>d.status==='pending').map(d=>`<div class="item between"><strong>${d.title}</strong><span class="status amber">${d.due||''}</span></div>`).join("")||'<p class="muted">Aucune décision en attente.</p>'}</div>
 <div class="card span-6"><h2>Jalons à surveiller</h2>${state.data.milestones.slice(0,6).map(m=>`<div class="item between"><strong>${m.title}</strong><span class="status ${m.status==='at_risk'?'amber':'blue'}">${m.date}</span></div>`).join("")||'<p class="muted">Aucun jalon.</p>'}</div>
 </div>`);}
function projectTable(){return `<table class="table"><thead><tr><th>Projet</th><th>Lead</th><th>RAG</th><th>Avancement</th><th>Budget</th><th></th></tr></thead><tbody>${state.data.projects.map(p=>`<tr><td>${p.name}</td><td>${p.lead||''}</td><td><span class="status ${rag(p)}">${rag(p).toUpperCase()}</span></td><td><div class="bar"><span style="width:${clamp(Number(p.progress||0),0,100)}%"></span></div></td><td>${money(p.spent)} / ${money(p.budget)}</td><td><button class="small ghost" data-action="openProject" data-id="${p.id}">Ouvrir</button></td></tr>`).join("")}</tbody></table>`;}
function alerts(){const out=[]; state.data.projects.forEach(p=>{if(rag(p)==='red')out.push({level:'red',type:'Projet rouge',text:p.name}); if(Number(p.spent||0)>Number(p.budget||0)*.85)out.push({level:'amber',type:'Budget',text:`${p.name} consomme ${money(p.spent)}`});}); state.data.tasks.filter(t=>t.status!=="done"&&new Date(t.end)<new Date()).forEach(t=>out.push({level:'red',type:'Retard',text:t.title})); return out.slice(0,8);}
function renderPortfolio(){layout("Portefeuille",`<div class="grid"><div class="card span-12"><div class="between"><h2>Portfolios</h2>${can('portfolio')?'<button data-action="addPortfolio">Nouveau portefeuille</button>':''}</div>${state.data.portfolios.length?`<table class="table"><thead><tr><th>Nom</th><th>Owner</th><th>Budget</th><th>Programmes</th></tr></thead><tbody>${state.data.portfolios.map(p=>`<tr><td>${p.name}</td><td>${p.owner||''}</td><td>${money(p.budget)}</td><td>${state.data.programs.filter(g=>g.portfolio_id===p.id).length}</td></tr>`).join("")}</tbody></table>`:empty("Aucun portefeuille.")}</div><div class="card span-12"><h2>Consolidation projets</h2>${state.data.projects.length?projectTable():empty("Aucun projet.")}</div></div>`);}
function renderProgram(){layout("Programme",`<div class="grid"><div class="card span-12"><div class="between"><h2>Programmes</h2>${can('portfolio')?'<button data-action="addProgram">Nouveau programme</button>':''}</div>${state.data.programs.length?`<table class="table"><thead><tr><th>Programme</th><th>Directeur</th><th>RAG</th><th>Projets</th></tr></thead><tbody>${state.data.programs.map(p=>`<tr><td>${p.name}</td><td>${p.director||''}</td><td><span class="status ${p.rag||'green'}">${(p.rag||'green').toUpperCase()}</span></td><td>${state.data.projects.filter(x=>x.program_id===p.id).length}</td></tr>`).join("")}</tbody></table>`:empty("Aucun programme.")}</div></div>`);}
function renderProject(){const p=activeProject(); if(!p)return layout("Projet",empty("Aucun projet sélectionné.")); const ts=projectTasks(p.id); layout("Projet",`<div class="grid">${metric("Avancement",(p.progress||0)+"%",p.status||"")}${metric("Budget",money(p.spent),`sur ${money(p.budget)}`)}${metric("Tâches",ts.length,"total")}${metric("Risques",projectRisks(p.id).length,"actifs")}<div class="card span-8"><div class="between"><h2>${p.name}</h2>${can('projectManage')?'<button data-action="addTask">Nouvelle tâche</button>':''}</div>${ts.length?ts.map(taskItem).join(""):empty("Aucune tâche sur ce projet.")}</div><div class="card span-4"><h2>Fiche projet</h2><p><strong>Lead</strong><br>${p.lead||''}</p><p><strong>Dates</strong><br>${p.start||''} → ${p.end||''}</p><p><strong>Statut</strong><br><span class="status ${rag(p)}">${rag(p).toUpperCase()}</span></p></div></div>`);}
function taskItem(t){return `<div class="item" draggable="true" data-task="${t.id}"><div class="between"><strong>${t.title}</strong><span class="status blue">${t.status}</span></div><p class="muted">${t.owner||''} · ${t.start||''} → ${t.end||''} · ${t.progress||0}%</p><div class="bar"><span style="width:${clamp(Number(t.progress||0),0,100)}%"></span></div></div>`;}
function renderPlanning(){const ts=projectTasks(); const months=["Juil","Août","Sep","Oct","Nov","Déc","Jan","Fév","Mar","Avr","Mai","Juin"]; layout("Planning visuel",`<div class="grid"><div class="card span-12"><div class="between"><h2>Gantt</h2>${can('projectManage')?'<button data-action="addTask">Ajouter tâche</button>':''}</div>${ts.length?`<div class="gantt"><div class="gantt-grid"><div></div>${months.map(m=>`<div class="gantt-head">${m}</div>`).join("")}${ts.map(ganttRow).join("")}</div></div>`:empty("Aucune tâche à planifier.")}</div><div class="card span-6"><h2>Jalons</h2>${state.data.milestones.filter(m=>!activeProject()||m.project_id===activeProject().id).map(m=>`<div class="item between"><strong>${m.title}</strong><span class="status ${m.status==='at_risk'?'amber':'blue'}">${m.date}</span></div>`).join("")||'<p class="muted">Aucun jalon.</p>'}</div><div class="card span-6"><h2>Chemin critique simplifié</h2>${ts.filter(t=>Number(t.priority||0)>=2&&t.status!=="done").map(t=>`<div class="item">${t.title} · ${daysBetween(t.start,t.end)} jours</div>`).join("")||'<p class="muted">Aucune tâche critique.</p>'}</div></div>`);}
function ganttRow(t){const sm=clamp(new Date(t.start||today()).getMonth()-6,0,11); const dur=clamp(Math.ceil(daysBetween(t.start,t.end)/30),1,12-sm); return `<div class="gantt-name">${t.title}<br><small class="muted">${t.progress||0}% · ${t.owner||''}</small></div>${Array.from({length:12},(_,i)=>i===sm?`<div class="gantt-task" style="grid-column:span ${dur}"></div>`:i>sm&&i<sm+dur?'':`<div class="gantt-cell"></div>`).join("")}`;}
function renderKanban(){const cols=[["todo","À faire"],["doing","En cours"],["review","Revue"],["done","Terminé"]]; layout("Kanban",`<div class="kanban">${cols.map(([s,l])=>`<div class="column" data-col="${s}"><h3>${l}</h3>${projectTasks().filter(t=>t.status===s).map(taskItem).join("")}</div>`).join("")}</div>`); enableDnD();}
function enableDnD(){if(!can('projectManage'))return; let id=null; document.querySelectorAll('[data-task]').forEach(el=>{el.ondragstart=()=>id=el.dataset.task;}); document.querySelectorAll('[data-col]').forEach(c=>{c.ondragover=e=>e.preventDefault(); c.ondrop=async()=>{const t=state.data.tasks.find(x=>x.id===id); if(t){t.status=c.dataset.col; await persist('tasks',t); await loadAll(); renderKanban();}};});}
function renderWorkload(){layout("Charge & capacité",`<div class="grid"><div class="card span-12"><h2>Capacité ressources</h2>${state.data.resources.length?`<table class="table"><thead><tr><th>Ressource</th><th>Capacité</th><th>Charge</th><th>Statut</th></tr></thead><tbody>${state.data.resources.map(r=>{const load=state.data.tasks.filter(t=>t.owner===r.name&&t.status!=="done").length; return `<tr><td>${r.name}</td><td>${r.capacity||0} j/s</td><td><div class="bar"><span style="width:${clamp(load/Math.max(r.capacity||1,1)*100,0,140)}%"></span></div></td><td><span class="status ${load>(r.capacity||0)?'red':'green'}">${load>(r.capacity||0)?'Surcharge':'OK'}</span></td></tr>`;}).join("")}</tbody></table>`:empty("Aucune ressource.")}</div></div>`);}
function renderBudget(){layout("Budget",`<div class="grid"><div class="card span-12"><h2>Budget, consommé, forecast</h2>${state.data.projects.length?`<table class="table"><thead><tr><th>Projet</th><th>Budget</th><th>Consommé</th><th>Progress</th><th>EAC</th><th>CPI</th></tr></thead><tbody>${state.data.projects.map(p=>{const cpi=(Number(p.progress||0)/100*Number(p.budget||0))/Math.max(Number(p.spent||0),1); const eac=Number(p.budget||0)/Math.max(cpi,.1); return `<tr><td>${p.name}</td><td>${money(p.budget)}</td><td>${money(p.spent)}</td><td>${p.progress||0}%</td><td>${money(eac)}</td><td>${cpi.toFixed(2)}</td></tr>`;}).join("")}</tbody></table>`:empty("Aucun budget.")}</div></div>`);}
function renderRisks(){layout("Risques",`<div class="grid"><div class="card span-5"><h2>Heatmap</h2><div class="heatmap">${Array.from({length:25},(_,i)=>{const impact=Math.floor(i/5)+1, probability=i%5+1, count=state.data.risks.filter(r=>Number(r.probability)===probability&&Number(r.impact)===impact).length, score=impact*probability; return `<div class="heat ${score>=15?'red':score>=8?'amber':'green'}">${count||''}</div>`;}).join("")}</div></div><div class="card span-7"><h2>Registre</h2>${projectRisks().map(r=>`<div class="item"><div class="between"><strong>${r.title}</strong><span class="status ${Number(r.probability)*Number(r.impact)>=12?'red':'amber'}">${Number(r.probability)*Number(r.impact)}</span></div><p class="muted">${r.owner||''} · ${r.mitigation||''}</p></div>`).join("")||'<p class="muted">Aucun risque.</p>'}</div></div>`);}
function renderGovernance(){layout("Gouvernance",`<div class="grid"><div class="card span-6"><h2>Décisions</h2>${state.data.decisions.map(d=>`<div class="item between"><div><strong>${d.title}</strong><p class="muted">${d.owner||''} · ${d.due||''}</p></div><span class="status ${d.status==='accepted'?'green':'amber'}">${d.status}</span></div>`).join("")||'<p class="muted">Aucune décision.</p>'}</div><div class="card span-6"><h2>Actions</h2>${state.data.actions.map(a=>`<div class="item between"><div><strong>${a.title}</strong><p class="muted">${a.owner||''} · ${a.due||''}</p></div><span class="status amber">${a.status}</span></div>`).join("")||'<p class="muted">Aucune action.</p>'}</div><div class="card span-12"><h2>Synthèse comité</h2><textarea readonly>${autoMinute()}</textarea></div></div>`);}
function autoMinute(){const k=kpis(); return `Synthèse portefeuille : ${k.projects} projets, avancement moyen ${k.progress}%, budget consommé ${money(k.spent)} sur ${money(k.budget)}. ${k.highRisks} risques élevés. ${state.data.decisions.filter(d=>d.status==='pending').length} décisions en attente. ${state.data.actions.filter(a=>a.status==='open').length} actions ouvertes.`;}
function renderReports(){layout("Reporting",`<div class="grid"><div class="card span-12"><div class="between"><h2>Reporting consolidé</h2><button data-action="copyReport">Copier synthèse</button></div><textarea readonly>${autoMinute()}\n\n${state.data.projects.map(p=>`${p.name}: ${p.progress||0}% · RAG ${rag(p)} · ${money(p.spent)}/${money(p.budget)}`).join('\n')}</textarea></div><div class="card span-12"><h2>Recherche globale</h2><input id="search" placeholder="chercher projet, tâche, risque..." value="${state.search}"><div id="searchResults"></div></div></div>`); $('#search').oninput=e=>{state.search=e.target.value; searchRender();}; searchRender();}
function searchRender(){const q=state.search.toLowerCase(); const all=[...state.data.projects.map(x=>['Projet',x.name]),...state.data.tasks.map(x=>['Tâche',x.title]),...state.data.risks.map(x=>['Risque',x.title]),...state.data.decisions.map(x=>['Décision',x.title])].filter(x=>q&&x[1]?.toLowerCase().includes(q)); $('#searchResults').innerHTML=all.map(x=>`<div class="item"><span class="pill">${x[0]}</span> ${x[1]}</div>`).join("");}
function renderAdmin(){const rows=ROLES.map(r=>`<tr><td>${ROLE_LABEL[r]}</td><td>${canAs(r,'contribute')}</td><td>${canAs(r,'projectManage')}</td><td>${canAs(r,'portfolio')}</td><td>${canAs(r,'governance')}</td><td>${canAs(r,'admin')}</td></tr>`).join(""); layout("Administration",`<div class="grid"><div class="card span-12"><h2>Utilisateurs</h2>${state.data.profiles.length?`<table class="table"><thead><tr><th>Email</th><th>Nom</th><th>Rôle</th><th></th></tr></thead><tbody>${state.data.profiles.map(p=>`<tr><td>${p.email}</td><td>${p.full_name||''}</td><td><select id="role-${p.id}">${ROLES.map(r=>`<option value="${r}" ${p.role===r?'selected':''}>${ROLE_LABEL[r]}</option>`).join('')}</select></td><td><button class="small ghost" data-action="updateRole" data-id="${p.id}">Mettre à jour</button></td></tr>`).join("")}</tbody></table>`:empty("Aucun profil visible.")}</div><div class="card span-12"><h2>Matrice de droits</h2><table class="table"><thead><tr><th>Rôle</th><th>Contribuer</th><th>Manager projet</th><th>Portefeuille</th><th>Gouvernance</th><th>Admin</th></tr></thead><tbody>${rows}</tbody></table></div><div class="card span-12"><h2>Audit</h2>${state.data.audit.slice(-30).reverse().map(a=>`<div class="item"><strong>${a.type}</strong><p class="muted">${a.label} · ${a.user_email||''} · ${a.at}</p></div>`).join("")||'<p class="muted">Aucun événement.</p>'}</div></div>`);}
function canAs(role,action){const old=state.role; state.role=role; const ok=can(action)?'✅':'—'; state.role=old; return ok;}
async function handleAction(action,id){
 if(action==='openProject'){state.projectId=id; state.view='project'; render(); return;}
 if(action==='addPortfolio'){if(!can('portfolio'))return toast('Droit insuffisant'); const row={id:uid(),name:'Nouveau portefeuille',owner:state.user.email,budget:0}; state.data.portfolios.push(row); await persist('portfolios',row); await loadAll(); render(); return;}
 if(action==='addProgram'){if(!can('portfolio'))return toast('Droit insuffisant'); const pf=state.data.portfolios[0]; if(!pf)return toast('Crée d’abord un portefeuille'); const row={id:uid(),portfolio_id:pf.id,name:'Nouveau programme',director:state.user.email,rag:'green'}; state.data.programs.push(row); await persist('programs',row); await loadAll(); render(); return;}
 if(action==='addProject'){if(!can('portfolio'))return toast('Droit insuffisant'); let pg=state.data.programs[0]; if(!pg){toast('Crée d’abord un programme'); return;} const row={id:uid(),program_id:pg.id,name:'Nouveau projet',lead:state.user.email,status:'Cadrage',start:today(),end:today(),budget:0,spent:0,progress:0,rag:'green'}; state.data.projects.push(row); await persist('projects',row); await loadAll(); state.projectId=row.id; render(); return;}
 if(action==='addTask'){if(!can('projectManage'))return toast('Droit insuffisant'); const p=activeProject(); if(!p)return toast('Crée d’abord un projet'); const row={id:uid(),project_id:p.id,title:'Nouvelle tâche',status:'todo',start:today(),end:today(),progress:0,owner:state.user.email,priority:1,cost:0,tags:[]}; state.data.tasks.push(row); await persist('tasks',row); await loadAll(); render(); return;}
 if(action==='updateRole'){if(!can('admin'))return toast('Droit insuffisant'); const role=document.getElementById(`role-${id}`)?.value; const {error}=await state.db.from('profiles').update({role}).eq('id',id); if(error)return toast(error.message); await loadAll(); render(); return;}
 if(action==='copyReport'){navigator.clipboard?.writeText(autoMinute()); toast('Synthèse copiée'); return;}
}
function toCsv(){return ['project,lead,rag,progress,budget,spent',...state.data.projects.map(p=>`"${p.name}","${p.lead||''}",${rag(p)},${p.progress||0},${p.budget||0},${p.spent||0}`)].join('\n');}
function download(name,content){const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type:'text/csv'})); a.download=name; a.click();}
boot();
