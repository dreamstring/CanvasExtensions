const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element{
 constructor(tag='div',text=''){this.tag=tag;this.text=text;this.children=[];this.style={};this.dataset={};this.attrs={};}
 get textContent(){return this.text+this.children.map(c=>c.textContent).join('');}set textContent(v){this.text=v;}
 get parentElement(){return this.parent||null;}get previousElementSibling(){const a=this.parent?.children||[];return a[a.indexOf(this)-1]||null;}
 get isConnected(){return !!this.parent;}
 getAttribute(k){return this.attrs[k]||'';}setAttribute(k,v){this.attrs[k]=v;}
 contains(el){return this===el||this.children.some(c=>c.contains(el));}
 remove(){if(this.parent)this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}
 append(...els){els.forEach(e=>this.appendChild(e));}appendChild(e){e.remove();this.children.push(e);e.parent=this;}
 insertBefore(e,b){e.remove();const i=this.children.indexOf(b);this.children.splice(i<0?this.children.length:i,0,e);e.parent=this;}
 after(e){this.parent.insertBefore(e,this.parent.children[this.parent.children.indexOf(this)+1]);}
 attachShadow(){return new Element('shadow');}
 querySelectorAll(selector){const all=this.children.flatMap(c=>[c,...c.querySelectorAll(selector)]);return all.filter(c=>selector.includes(c.tag));}
}
const side=new Element('div');const fill=new Element('div'),wrap=new Element('div'),title=new Element('span','Fill');wrap.append(title);fill.append(wrap,new Element('div','Image'));const stroke=new Element('div');stroke.append(new Element('button','Stroke'));const exp=new Element('div');exp.append(new Element('button','Export'));side.append(fill,stroke,exp);
const context={document:{createElement:t=>new Element(t),querySelector:()=>side,body:new Element()},MutationObserver:class{observe(){}disconnect(){}}};context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync('runtime/framework.js','utf8'),context);
const host=context.FigmaExtensions;host.begin('box',[]);const box=host.createSection('box','Box',{afterSection:['Fill'],insideSection:true});host.register('box',{dispose(){box.dispose();}});host.end();box.show();assert.equal(box.root.parentElement,fill);assert.equal(fill.children.at(-1),box.root);box.show();assert.equal(fill.children.filter(c=>c===box.root).length,1);box.show(false);assert(!fill.contains(box.root));box.show();assert.equal(box.root.parentElement,fill);host.dispose();assert(!fill.contains(box.root));
console.log('PASS Box placement: span Fill heading, nested wrappers, inside correct section, hide/remount/dispose');
