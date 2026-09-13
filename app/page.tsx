const leads = [
  { name: "João da Silva", phone: "41999999999", origin: "Meta Ads", status: "Novo", tone: "blue" },
  { name: "Maria Souza", phone: "41988888888", origin: "Indicação", status: "Em atendimento", tone: "amber" },
  { name: "Carlos Lima", phone: "41977777777", origin: "Formulário", status: "Visita", tone: "green" },
];

function whatsapp(phone: string) {
  return `https://wa.me/55${phone}`;
}

export default function Home() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">CRM <span>T3</span></div>
        <nav className="nav">
          <a className="active" href="#">Dashboard</a>
          <a href="#leads">Leads</a>
          <a href="#">Atendimentos</a>
          <a href="#">Imóveis</a>
          <a href="#">Visitas</a>
          <a href="#">Propostas</a>
          <a href="#">Relatórios</a>
          <a href="#">Configurações</a>
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <strong>CRM Imobiliário</strong>
          <span style={{ color: "#6b7280", fontSize: 14 }}>Bruno · Gerente</span>
        </header>

        <div className="page">
          <div className="eyebrow">Visão geral</div>
          <h1>Dashboard</h1>
          <p className="sub">Acompanhe seus leads e atendimentos em um só lugar.</p>

          <section className="grid">
            <div className="card"><div className="metric-label">Leads</div><div className="metric">32</div></div>
            <div className="card"><div className="metric-label">Novos</div><div className="metric">8</div></div>
            <div className="card"><div className="metric-label">Visitas</div><div className="metric">3</div></div>
            <div className="card"><div className="metric-label">Propostas</div><div className="metric">1</div></div>
          </section>

          <section className="card" id="leads">
            <div className="toolbar">
              <div><h2 className="section-title">Últimos leads</h2></div>
              <button className="btn primary">+ Novo lead</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Cliente</th><th>Telefone</th><th>Origem</th><th>Status</th><th>Ações</th></tr></thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.phone}>
                      <td><strong>{lead.name}</strong></td>
                      <td>{lead.phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")}</td>
                      <td>{lead.origin}</td>
                      <td><span className={`status ${lead.tone}`}>{lead.status}</span></td>
                      <td><div className="actions"><a className="btn whatsapp" href={whatsapp(lead.phone)} target="_blank" rel="noreferrer">WhatsApp</a><button className="btn">Ver</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
