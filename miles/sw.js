if(!self.define){let e,i={};const n=(n,r)=>(n=new URL(n+".js",r).href,i[n]||new Promise((i=>{if("document"in self){const e=document.createElement("script");e.src=n,e.onload=i,document.head.appendChild(e)}else e=n,importScripts(n),i()})).then((()=>{let e=i[n];if(!e)throw new Error(`Module ${n} didn’t register its module`);return e})));self.define=(r,t)=>{const o=e||("document"in self?document.currentScript.src:"")||location.href;if(i[o])return;let s={};const l=e=>n(e,o),d={module:{uri:o},exports:s,require:l};i[o]=Promise.all(r.map((e=>d[e]||l(e)))).then((e=>(t(...e),s)))}}define(["./workbox-5ffe50d4"],(function(e){"use strict";self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"index.html",revision:null},{url:"registerSW.js",revision:null},{url:"icon.png",revision:"d95485581075971fcfe623fdfb77dcba"},{url:"manifest.webmanifest",revision:"013b8c346ded46805e3dd0878aabb0ab"}],{}),e.cleanupOutdatedCaches(),e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("index.html")))}));
