window.KagieUI = {
  statusBadge(status='Draft'){ return `<span class="status ${KagieAPI.statusClass(status)}">${status}</span>`; },
  paymentBadge(status='Payment Pending'){ return `<span class="status ${KagieAPI.statusClass(status)}">${status}</span>`; },
  qs(name){ return new URLSearchParams(location.search).get(name); },
  fmt(date){ try{return new Date(date).toLocaleString();}catch{return date||'-';} },
  safe(v){ return v ?? '-'; }
};
