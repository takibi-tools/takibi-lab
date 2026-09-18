'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'yomitoki-en.html'),'utf8');
const demoHtml=fs.readFileSync(path.join(root,'yomitoki-en-demo/index.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const demoSource=demoHtml.match(/<script>([\s\S]*?)<\/script>/)[1];
const snapshot=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/yomitoki-en-photo.json'),'utf8'));
const crypto=require('node:crypto');
const clone=x=>JSON.parse(JSON.stringify(x));
const jp=/[ぁ-んァ-ン一-龯]/;
const testExports='DEMO,FLAG_DEF,FLAG_LABEL,TYPE_LABEL,TYPE_BADGE,TYPE_HELP,cleanFlags,displayFlag,tagsHtml,render,renderDemoRecheck';
function setup(fixtures=[],demo=false){
  const elements=new Map(),timers=new Map(),intervals=new Map(),requests=[],storage=new Map();
  let n=0,now=0,copied='';
  class TestDate extends Date{static now(){return now;}}
  function el(id){if(!elements.has(id)){const classes=new Set();elements.set(id,{
    value:'',textContent:'',innerHTML:'',disabled:false,handlers:{},attributes:{},
    classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:(x,on)=>on?classes.add(x):classes.delete(x)},
    addEventListener(e,f){this.handlers[e]=f;},setAttribute(k,v){this.attributes[k]=v;},
    querySelector(){return null;},focus(){},scrollIntoView(){}
  });}return elements.get(id);}
  const context=vm.createContext({document:{getElementById:el},Date:TestDate,AbortController,
    navigator:{clipboard:{writeText:async text=>{copied=text;}}},
    localStorage:{getItem:k=>storage.get(k)||'',setItem:(k,v)=>storage.set(k,v)},
    setTimeout(f,delay){const id=++n;timers.set(id,{f,delay});return id;},clearTimeout:id=>timers.delete(id),
    setInterval(f){const id=++n;intervals.set(id,f);return id;},clearInterval:id=>intervals.delete(id),
    async fetch(url,options){requests.push({url,options});assert.ok(fixtures.length,'Unexpected API request');
      let value=fixtures.shift();if(typeof value==='function')value=await value(options.signal);
      if(value instanceof Error)throw value;
      if(value?.response)return value.response;
      if(value?.http)return {ok:false,status:value.http,json:async()=>({error:{message:'Mock provider error'}})};
      return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(value)}]}}]})};
    }
  });
  vm.runInContext((demo?demoSource:source).replace(/\}\)\(\);\s*$/,'globalThis.testApi={'+testExports+(demo?'':',CRITERIA,buildPrompt,buildRecheckPrompt,validateSegments')+'};})();'),context);
  if(!demo){el('apikey').value='local-test-placeholder';el('question').value=snapshot.question;el('reply').value=snapshot.reply;}
  return {el,timers,intervals,requests,storage,api:context.testApi,copy:()=>copied,
    advance(s){now+=s*1000;intervals.forEach(f=>f());},expire(){const entry=[...timers].find(([,v])=>v.delay===90000);assert.ok(entry);timers.delete(entry[0]);entry[1].f();}};
}
const first=clone(snapshot.result);
const clean={segments:[{text:first.remeasured,type:'意見',flags:[],phrase:'',note:''}]};
const tick=()=>new Promise(r=>setImmediate(r));
const abort=()=>Object.assign(new Error('Aborted'),{name:'AbortError'});
const hang=signal=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(abort())));
const hangBody=signal=>({response:{ok:true,json:()=>hang(signal)}});
function recovered(e){assert.equal(e.el('run').disabled,false);assert.equal(e.el('sample').disabled,false);assert.equal(e.intervals.size,0);assert.equal([...e.timers.values()].filter(t=>t.delay===90000).length,0);}
function permutations(a){return a.length?a.flatMap((v,i)=>permutations(a.filter((_,j)=>i!==j)).map(p=>[v,...p])):[[]];}
(async()=>{
  const checks=[];
  new vm.Script(source);new vm.Script(demoSource);
  const criteriaSource=source.match(/var CRITERIA = \[[\s\S]*?\].join\("\\n"\);/)[0].replace(/\r\n/g,'\n');
  assert.equal(crypto.createHash('sha256').update(criteriaSource).digest('hex'),'122f05af15c71d5b3e420b0c03fbb30ebf7d03296dcb7f7a9c6b871502fbd12a');
  for(const page of [html,demoHtml]){
    assert.match(page,/<html lang="en">/);
    assert.equal(jp.test(page.replace(/<style>[\s\S]*?<\/style>/,'').replace(/<script>[\s\S]*?<\/script>/,'')),false);
    for(const color of ['--shu:#C2452F','--midori:#2F7A4F','--kohaku:#9C6412','--ai:#2E4E9A'])assert.ok(page.includes(color));
  }
  checks.push('Japanese criteria hash, four color values and English page metadata are preserved');
  const e=setup(),d=setup([],true);const types=Object.keys(e.api.TYPE_BADGE),flags=Object.keys(e.api.FLAG_DEF);
  assert.deepEqual(types,['事実','推論','意見','励まし','問い']);
  for(const t of types){assert.ok(e.api.TYPE_LABEL[t]);assert.equal(jp.test(e.api.TYPE_LABEL[t]+e.api.TYPE_HELP[t]),false);}
  for(const f of flags){assert.ok(e.api.FLAG_LABEL[f]);assert.equal(jp.test(e.api.FLAG_LABEL[f]),false);}
  checks.push('Five stable type keys and four stable issue keys have English labels and definitions');

  let combinations=0;
  for(let mask=0;mask<16;mask++)for(const fs1 of permutations(flags.filter((_,i)=>mask&(1<<i))))for(const primary of [...flags,'invalid',undefined]){
    const seg={text:'English input stays intact.',type:'事実',flags:fs1,primary,note:'A mock finding.'};
    const before=JSON.stringify(seg);const chosen=e.api.displayFlag(seg);
    const specific=fs1.filter(f=>f!=='根拠なき断定');
    const expected=!fs1.length?'':!specific.length?'根拠なき断定':specific.includes(primary)?primary:specific[0];
    assert.equal(chosen,expected);assert.equal(d.api.displayFlag(seg),expected);
    const tags=e.api.tagsHtml(e.api.cleanFlags(seg));
    for(const f of fs1)assert.ok(tags.includes(e.api.FLAG_LABEL[f]));
    assert.equal(jp.test(tags),false);assert.equal(JSON.stringify(seg),before);combinations++;
  }
  assert.equal(e.api.displayFlag({flags:['根拠なき断定','過剰肯定','出どころなき引用'],primaryFlag:'出どころなき引用'}),'出どころなき引用');
  checks.push('Every flag set, order and primary choice preserves all findings and uses the same representative color in app and demo');

  assert.deepEqual(clone(e.api.DEMO),snapshot);assert.deepEqual(clone(d.api.DEMO),snapshot);
  assert.equal(first.segments.map(s=>s.text).join(''),snapshot.reply);
  assert.equal(snapshot.provenance.englishLiveApiRun,false);assert.equal(snapshot.provenance.rawApiResponseAvailable,false);
  assert.equal(snapshot.recheck,undefined);assert.equal(first.summary,'');
  assert.ok(first.segments.every(s=>!Object.hasOwn(s,'primary')));
  e.el('apikey').value='';e.el('question').value='My own question';e.el('reply').value='My own English reply';
  e.el('sample').handlers.click();assert.equal(e.requests.length,0);
  assert.match(e.el('result-note').innerHTML,/Translated and reconstructed.*Japanese/);
  assert.match(e.el('result-note').innerHTML,/not an English API result/);
  assert.match(e.el('recheck').innerHTML,/saved Japanese/);
  e.el('sample').handlers.click();assert.equal(e.el('question').value,'My own question');assert.equal(e.el('reply').value,'My own English reply');
  assert.equal(e.el('result').classList.contains('show'),false);
  assert.doesNotMatch(demoSource,/\bfetch\s*\(|localStorage|callGemini/);assert.doesNotMatch(demoHtml,/<input[^>]*password/);
  checks.push('Translated photo sample is labeled accurately, makes no API call, and restores both original inputs; standalone demo has no API or key storage');

  const done=setup([clone(first),clone(clean)]);await done.el('run').handlers.click();recovered(done);
  assert.equal(done.requests.length,2);assert.equal(done.el('status').textContent,'Inspection complete.');
  assert.match(done.el('recheck').innerHTML,/No issues were found in this second inspection/);
  assert.equal(done.el('remeasured').textContent,first.remeasured);
  for(const r of done.requests){assert.equal(new URL(r.url).origin,'https://generativelanguage.googleapis.com');assert.equal(new URL(r.url).search,'');assert.equal(r.options.headers['x-goog-api-key'],'local-test-placeholder');
    const prompt=JSON.parse(r.options.body).contents[0].parts[0].text;
    assert.match(prompt,/write summary, note, and remeasured in natural English/);assert.match(prompt,/fixed machine keys/);
    assert.ok(prompt.includes(done.api.CRITERIA));}
  for(const id of ['marked','findings','recheck']){const visible=done.el(id).innerHTML.replace(/<[^>]*>/g,'');assert.equal(jp.test(visible),false,id);}
  done.el('copy').handlers.click();await tick();assert.equal(done.copy(),first.remeasured);assert.equal(done.el('copied').textContent,'Copied');
  checks.push('English input, all translated findings, English rewrite and copy work in the two-call flow; prompts request English and preserve response keys');

  let resolve1,resolve2;
  const busy=setup([()=>new Promise(r=>resolve1=r),()=>new Promise(r=>resolve2=r)]);
  const pending=busy.el('run').handlers.click();assert.equal(busy.el('sample').disabled,true);busy.el('sample').handlers.click();busy.el('run').handlers.click();assert.equal(busy.requests.length,1);
  busy.advance(5);assert.match(busy.el('status').textContent,/5s/);resolve1(clone(first));for(let i=0;i<8&&busy.requests.length<2;i++)await tick();
  busy.el('sample').handlers.click();assert.equal(busy.el('reply').value,snapshot.reply);resolve2(clone(clean));await pending;recovered(busy);
  const remains=setup([clone(first),{segments:[{...clone(clean.segments[0]),flags:['根拠なき断定','過剰肯定']}]}]);await remains.el('run').handlers.click();
  assert.match(remains.el('recheck').innerHTML,/still has issues/);assert.match(remains.el('recheck').innerHTML,/Unsupported assertion/);assert.match(remains.el('recheck').innerHTML,/Excessive affirmation/);assert.equal(remains.requests.length,2);
  checks.push('Sample and run cannot interrupt either pass; elapsed time, remaining issues and exactly two requests are preserved');

  let failureCases=0;
  for(const second of [false,true])for(const failure of [new Error('Offline'),{http:400},{http:403},{http:404},{http:429},{http:500},{http:503},{segments:[]},{segments:[{...clone(clean.segments[0]),text:'Missing text'}]},{segments:[{...clone(clean.segments[0]),type:'invalid'}]},{segments:[{...clone(clean.segments[0]),flags:['invalid']}]},{response:{ok:true,json:async()=>{throw new SyntaxError('Invalid JSON');}}},{response:{ok:true,json:async()=>({candidates:[]})}}]){
    const x=setup(second?[clone(first),failure]:[failure]);await x.el('run').handlers.click();recovered(x);
    assert.equal(x.el('status').classList.contains('error'),true);assert.notEqual(x.el('status').textContent,'Inspection complete.');
    if(second){assert.match(x.el('recheck').innerHTML,/Second inspection incomplete/);assert.doesNotMatch(x.el('recheck').innerHTML,/No issues/);assert.equal(x.el('remeasured').textContent,first.remeasured);}failureCases++;
  }
  for(const second of [false,true])for(const failure of [hang,hangBody]){
    const x=setup(second?[clone(first),failure]:[failure]);const p=x.el('run').handlers.click();for(let i=0;i<8;i++)await tick();x.expire();await p;recovered(x);assert.match(x.el('status').textContent,/timed out/);
    if(second){assert.match(x.el('recheck').innerHTML,/Second inspection incomplete/);assert.doesNotMatch(x.el('recheck').innerHTML,/No issues/);}failureCases++;
  }
  checks.push('All failure cases including second-pass timeout/body timeout remain incomplete, preserve the revision, and recover controls');

  const escaped=setup();const hostile='<img src=x onerror=alert(1)>';
  escaped.api.render({segments:[{text:hostile,type:'事実',flags:['根拠なき断定'],phrase:hostile,note:hostile}],summary:hostile,remeasured:hostile},false);
  for(const id of ['marked','findings']){assert.doesNotMatch(escaped.el(id).innerHTML,/<img/);assert.match(escaped.el(id).innerHTML,/&lt;img/);}
  const empty=setup();empty.el('apikey').value='';await empty.el('run').handlers.click();assert.equal(empty.requests.length,0);
  empty.storage.set('yomitoki_key','placeholder');empty.el('apikey').handlers.input.call(empty.el('apikey'));assert.equal(empty.storage.get('yomitoki_key'),'');
  checks.push('HTML is escaped, missing keys prevent requests, and clearing a key removes the stored value');
  console.log(JSON.stringify({passed:checks.length,colorCombinations:combinations,failureCases,checks,liveApiCalled:false,limitation:'Mock API and minimal DOM; live English model behavior requires an actual API test.'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
