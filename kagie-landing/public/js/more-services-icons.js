(function () {
  "use strict";
  const paths = {
    back: '<path d="m14 5-7 7 7 7"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    list: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M10 8h6m-6 4h6m-6 4h6M7 8h.01M7 12h.01M7 16h.01"/>',
    document: '<path d="M14 2H5a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8zM14 2v6h6M8 12h8m-8 4h8M8 8h2"/>',
    cap: '<path d="m2 8 10-5 10 5-10 5-10-5Zm4 3v6c4 3 8 3 12 0v-6m4-3v9"/>',
    person: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2H4Z"/>',
    people: '<circle cx="8" cy="7" r="3"/><circle cx="18" cy="8" r="2.5"/><path d="M1 21v-3a7 7 0 0 1 14 0v3H1Zm15-7a5 5 0 0 1 7 4v3h-5"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2 6m2-14v6h-6"/>',
    chart: '<path d="M4 20V10m8 10V4m8 16v-7"/>',
    headset: '<path d="M4 13V9a8 8 0 0 1 16 0v4m-1 6c0 3-3 3-7 3"/><rect x="2" y="11" width="5" height="8" rx="2"/><rect x="17" y="11" width="5" height="8" rx="2"/>',
    target: '<circle cx="12" cy="13" r="8"/><circle cx="12" cy="13" r="3"/><path d="M12 2v7"/>',
    home: '<path d="m3 10 9-7 9 7v11h-6v-8H9v8H3V10Z"/>',
    business_center: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18m-12 0v3h6v-3"/>',
    school: '<path d="m2 8 10-5 10 5-10 5-10-5Zm4 3v6c4 3 8 3 12 0v-6m4-3v9"/>',
    apartment: '<path d="M4 21V3h10v18M14 8h6v13M2 21h20M8 7h2m-2 4h2m-2 4h2m8-3h.01M18 16h.01M8 21v-3h2v3"/>',
    directions_bus: '<rect x="5" y="3" width="14" height="17" rx="3"/><path d="M5 12h14M8 7h8M7 20v2m10-2v2M8 16h.01M16 16h.01"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.document}</svg>`;
  function artwork(name) {
    const prefix = 'ms-art-' + name;
    const coin = (x,y,width,height) => `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" fill="url(#${prefix}-gold)"/><path d="M${x+2} ${y+height-9}q${width/2} 9 ${width-4} 0" fill="none" stroke="#fd0505" stroke-width="2"/><ellipse cx="${x+width/2}" cy="${y}" rx="${width/2}" ry="9" fill="#ffb500" stroke="#ffe9b3" stroke-width="2"/><ellipse cx="${x+width/2}" cy="${y}" rx="${width/2-5}" ry="5" fill="#ffb500"/></g>`;
    const badge = content => `<circle cx="85" cy="83" r="20" fill="url(#${prefix}-red)" stroke="white" stroke-width="2"/>${content}`;
    const objects = {
      funding: `<g filter="url(#${prefix}-shadow)">${coin(15,70,31,27)}${coin(57,59,38,38)}${coin(51,49,38,28)}${coin(17,58,34,28)}<path d="M49 38h50v20c-14 10-35 10-50 0V38" fill="#22252b"/><path d="m32 29 44-16 43 16-44 17-43-17Z" fill="url(#${prefix}-dark)"/><path d="m34 29 42-13 39 13" fill="none" stroke="#6c6e70" stroke-width="2"/><path d="m76 29 31 6v27" stroke="#fd0505" stroke-width="3" fill="none"/><path d="M104 61h6l2 13h-10l2-13Z" fill="#fd0505"/></g>`,
      email: `<g filter="url(#${prefix}-shadow)" transform="rotate(-8 60 60)"><rect x="22" y="31" width="77" height="64" rx="10" fill="url(#${prefix}-red)"/><rect x="31" y="20" width="58" height="59" rx="6" fill="#fff"/><path d="m22 49 38 29 39-29v41a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6V49Z" fill="url(#${prefix}-red)"/><path d="m25 92 32-22m38 22L64 70" stroke="#fd0505" stroke-width="2"/><text x="60" y="59" text-anchor="middle" fill="#fd0505" font-family="Arial,sans-serif" font-weight="700" font-size="36">@</text></g>`,
      reapply: `<g filter="url(#${prefix}-shadow)"><rect x="24" y="19" width="66" height="83" rx="11" fill="#fff" stroke="#fff1f1" stroke-width="3"/><path d="M39 38h36M39 50h36M39 62h24M39 74h16" stroke="#fd0505" stroke-width="5" stroke-linecap="round"/>${badge('<path d="M77 80a9 9 0 1 1 1 10m-1-18v8h8" stroke="white" stroke-width="2.6" fill="none" stroke-linecap="round"/>')}</g>`,
      pin: `<g filter="url(#${prefix}-shadow)"><path d="M37 55V36a23 23 0 0 1 46 0v19" fill="none" stroke="#2d9df9" stroke-width="13"/><path d="M34 52V36a23 23 0 0 1 46 0v16" fill="none" stroke="url(#${prefix}-blue)" stroke-width="9"/><rect x="22" y="49" width="74" height="55" rx="11" fill="url(#${prefix}-blue)"/><path d="M28 58v33" stroke="#2d9df9" stroke-width="3" stroke-linecap="round"/><circle cx="58" cy="70" r="7" fill="white"/><path d="M55 73h6l2 14H53l2-14Z" fill="white"/><circle cx="90" cy="87" r="19" fill="#2d9df9" stroke="#2d9df9" stroke-width="2"/><text x="90" y="96" text-anchor="middle" fill="white" font-size="28" font-weight="700" font-family="Arial">?</text></g>`,
      student: `<g filter="url(#${prefix}-shadow)"><rect x="13" y="31" width="93" height="63" rx="13" fill="url(#${prefix}-silver)"/><circle cx="39" cy="51" r="10" fill="#2d9df9"/><path d="M24 78v-5a15 15 0 0 1 30 0v5H24Z" fill="#2d9df9"/><path d="M64 49h25M64 61h21M64 72h14" stroke="#2d9df9" stroke-width="5" stroke-linecap="round"/>${badge('<text x="85" y="93" text-anchor="middle" fill="white" font-size="29" font-weight="700" font-family="Arial">?</text>')}</g>`,
      support: `<g filter="url(#${prefix}-shadow)"><path d="M26 67V52a34 34 0 0 1 68 0v15" fill="none" stroke="url(#${prefix}-red)" stroke-width="11"/><rect x="18" y="57" width="21" height="35" rx="10" fill="url(#${prefix}-red)"/><rect x="81" y="57" width="21" height="35" rx="10" fill="url(#${prefix}-red)"/><path d="M88 90c-2 12-16 16-27 14" fill="none" stroke="#fd0505" stroke-width="6"/><rect x="51" y="99" width="20" height="9" rx="4" fill="#fd0505"/></g>`
    };
    return `<svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="${prefix}-red" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fd0505"/><stop offset=".45" stop-color="#fd0505"/><stop offset="1" stop-color="#fd0505"/></linearGradient><linearGradient id="${prefix}-blue" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#2d9df9"/><stop offset=".45" stop-color="#2d9df9"/><stop offset="1" stop-color="#2d9df9"/></linearGradient><linearGradient id="${prefix}-gold"><stop stop-color="#ffb500"/><stop offset=".4" stop-color="#ffb500"/><stop offset="1" stop-color="#fd0505"/></linearGradient><linearGradient id="${prefix}-dark" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#55575c"/><stop offset="1" stop-color="#15171b"/></linearGradient><linearGradient id="${prefix}-silver" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fafbfe"/><stop offset="1" stop-color="#c5cbd6"/></linearGradient><filter id="${prefix}-shadow" x="-30%" y="-30%" width="170%" height="170%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#162443" flood-opacity=".12"/></filter></defs><ellipse cx="61" cy="107" rx="39" ry="6" fill="#eef2f8"/>${objects[name] || objects.support}</svg>`;
  }
  window.KagieServiceIcons = Object.freeze({icon, artwork});
})();
