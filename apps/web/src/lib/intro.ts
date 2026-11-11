// The opening sequence is decided before the first paint, by a tiny inline script, so a return visit never flashes it.
// data-intro on <html>: "lock" = first visit to the home page in this tab (overlay plus headline), "stamp" = headline only,
// "done" = the overlay has run. Absent = no opening at all (motion reduced or off, data saver, no session storage on "/").

/** Hard limit for the overlay, from first paint. */
export const INTRO_END_MS = 1750;
/** When the overlay starts to split. */
export const INTRO_SPLIT_MS = 1250;
/** How long the shortened exit takes after a skip. */
export const INTRO_SKIP_MS = 320;

export const INTRO_SESSION_KEY = "datum.intro";

export const INTRO_GATE = `(function(){try{var d=document.documentElement,l=location,m=null,s=null,c=navigator.connection;try{m=localStorage.getItem("datum.motion");s=localStorage.getItem("datum.intro")}catch(e){}if(/[?&]motion=off/.test(l.search)||m==="reduced"||m==="off"||matchMedia("(prefers-reduced-motion: reduce)").matches||(c&&c.saveData))return;var v="stamp";if(l.pathname==="/"&&s!=="off"){try{if(!sessionStorage.getItem("${INTRO_SESSION_KEY}")){sessionStorage.setItem("${INTRO_SESSION_KEY}","1");v="lock"}}catch(e){}}d.setAttribute("data-intro",v)}catch(e){}})();`;
