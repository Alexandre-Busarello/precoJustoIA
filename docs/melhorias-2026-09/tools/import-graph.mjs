import fs from 'fs'; import path from 'path';
const ROOT=process.cwd();
const walk=(d)=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const p=path.join(d,e.name); if(e.isDirectory()) return e.name==='node_modules'?[]:walk(p); return /\.(tsx?|jsx?|mjs)$/.test(e.name)?[p]:[]});
const src=walk(path.join(ROOT,'src'));
const scripts=fs.existsSync(path.join(ROOT,'scripts'))?walk(path.join(ROOT,'scripts')):[];
const all=[...src,...scripts];
const exts=['','.ts','.tsx','.js','.jsx','.mjs','/index.ts','/index.tsx','/index.js'];
const resolve=(from,spec)=>{let base; if(spec.startsWith('@/')) base=path.join(ROOT,'src',spec.slice(2)); else if(spec.startsWith('.')) base=path.resolve(path.dirname(from),spec); else return null;
 for(const e of exts){const p=base+e; if(fs.existsSync(p)&&fs.statSync(p).isFile()) return p;} return null;};
const graph={};
for(const f of all){const s=fs.readFileSync(f,'utf8'); const deps=new Set();
 for(const m of s.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)){const r=resolve(f,m[1]); if(r) deps.add(r);} graph[f]=[...deps];}
const special=/^(page|layout|route|loading|error|not-found|template|default|global-error|sitemap|robots|manifest|opengraph-image|twitter-image|icon|apple-icon)\.(tsx?|jsx?)$/;
const roots=all.filter(f=>{const rel=path.relative(ROOT,f); if(rel.startsWith('scripts/')) return true; if(rel==='src/middleware.ts'||rel.startsWith('src/instrumentation')) return true; if(rel.startsWith('src/app/')&&special.test(path.basename(f))) return true; if(rel.startsWith('src/app/actions/')) return false; return false;});
const seen=new Set(); const st=[...roots]; while(st.length){const f=st.pop(); if(seen.has(f)) continue; seen.add(f); for(const d of graph[f]||[]) st.push(d);}
const dead=src.filter(f=>!seen.has(f)).map(f=>path.relative(ROOT,f));
// Also: reachable only from scripts
const seen2=new Set(); const st2=roots.filter(f=>!path.relative(ROOT,f).startsWith('scripts/')); while(st2.length){const f=st2.pop(); if(seen2.has(f)) continue; seen2.add(f); for(const d of graph[f]||[]) st2.push(d);}
const scriptOnly=src.filter(f=>seen.has(f)&&!seen2.has(f)).map(f=>path.relative(ROOT,f));
const loc=f=>fs.readFileSync(path.join(ROOT,f),'utf8').split('\n').length;
console.log('DEAD ('+dead.length+'), LOC '+dead.reduce((a,f)=>a+loc(f),0)); for(const f of dead) console.log('  '+f+' '+loc(f));
console.log('SCRIPT-ONLY ('+scriptOnly.length+')'); for(const f of scriptOnly) console.log('  '+f+' '+loc(f));
