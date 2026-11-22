const fs=require('fs'),path=require('path');
const root='rt/include/rive/generated';const files=[];
(function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);fs.statSync(p).isDirectory()?walk(p):p.endsWith('_base.hpp')&&files.push(p);}})(root);
const props={},types={},pname={};
const T={Uint:0,String:1,Double:2,Color:3,Bool:0,Int:0,Bytes:1,Id:0,Callback:-1};
for(const f of files){const s=fs.readFileSync(f,'utf8');
  const cls=(s.match(/class (\w+)Base\b/)||[])[1]; const tk=(s.match(/typeKey = (\d+);/)||[])[1]; if(cls&&tk)types[tk]=cls;
  const keyOf={};for(const m of s.matchAll(/(\w+)PropertyKey = (\d+);/g))keyOf[m[1]]=+m[2];
  for(const m of s.matchAll(/case (\w+)PropertyKey:[^]{0,200}?Core(\w+)Type::(?:runtimeD|d)eserialize/g)){const k=keyOf[m[1]];if(k!==undefined){props[k]=T[m[2]];pname[k]=cls+'.'+m[1];}}
}
fs.writeFileSync('defs.json',JSON.stringify({props,types,pname}));
console.log(Object.keys(props).length,'props',Object.keys(types).length,'types', 'unk types', [...new Set(Object.values(props))]);
