// -------------------------
// 1. Generar dinámicamente los campos para participantes
// -------------------------
const generateInputsBtn = document.getElementById('generateInputsBtn');
const participantsInputContainer = document.getElementById('participantsInputContainer');
const numParticipantsInput = document.getElementById('numParticipants');

generateInputsBtn.addEventListener('click', () => {
  participantsInputContainer.innerHTML = '';
  const num = parseInt(numParticipantsInput.value);

  for (let i = 0; i < num; i++) {
    const div = document.createElement('div');
    div.innerHTML = `
      <label>Nombre:</label>
      <input type="text" id="name_${i}" placeholder="Persona ${i+1}"/>
      <label>Aportación:</label>
      <input type="number" step="0.01" id="amount_${i}" placeholder="0"/>
    `;
    participantsInputContainer.appendChild(div);
  }
});

// -------------------------
// 2. Cálculo de la lógica
// -------------------------
const calculateBtn = document.getElementById('calculateBtn');
const totalSpentInput = document.getElementById('totalSpent');
const resultContainer = document.getElementById('resultContainer');

calculateBtn.addEventListener('click', () => {
  const num = parseInt(numParticipantsInput.value);
  const participants = [];

  // Recogemos los datos de cada participante
  let totalAportaciones = 0;
  for (let i = 0; i < num; i++) {
    const name = document.getElementById(`name_${i}`).value.trim() || `Persona${i+1}`;
    const amount = parseFloat(document.getElementById(`amount_${i}`).value) || 0;
    participants.push({ name, amount });
    totalAportaciones += amount;
  }

  // Gasto total
  const totalSpent = parseFloat(totalSpentInput.value) || 0;

  // Sobrante global (si es +, hay dinero de sobra; si es -, falta dinero)
  const sobrante = totalAportaciones - totalSpent;

  // Costo por persona
  const costoPorPersona = parseFloat((totalSpent / num).toFixed(2));

  // Balance = aportación - costoPorPersona
  const balances = participants.map(p => {
    const balance = p.amount - costoPorPersona;
    return {
      name: p.name,
      balance: parseFloat(balance.toFixed(2))
    };
  });

  // 1. Repartir el sobrante (si existe) de menor a mayor entre los que tienen balance > 0
  let leftoverTransactions = [];
  if (sobrante > 0) {
    leftoverTransactions = distributeLeftoverSequentially(balances, sobrante);
  }

  // 2. Después de esa operación, algunos balances positivos pueden haberse reducido.
  //    Ahora, calculamos las transacciones de pago entre deudores (balance < 0) y acreedores (balance > 0).
  const payTransactions = minimizeTransactions(balances);

  // 3. Renderizar
  renderResults(balances, totalAportaciones, totalSpent, sobrante, leftoverTransactions, payTransactions, costoPorPersona);
});

// -------------------------
// 3. Reparto secuencial del sobrante a quienes tienen balance > 0
//    (ordenados de menor a mayor)
// -------------------------
function distributeLeftoverSequentially(balances, leftover) {
  let creditors = balances.filter(b => b.balance > 0);
  // Orden ascendente
  creditors.sort((a, b) => a.balance - b.balance);

  const transactions = [];
  let remain = leftover;

  for (let c of creditors) {
    if (remain <= 0) break;
    const canGive = Math.min(remain, c.balance);
    transactions.push({
      from: "Sobrante",
      to: c.name,
      amount: parseFloat(canGive.toFixed(2))
    });
    // Se reduce su balance
    c.balance -= canGive;
    // Se reduce el sobrante
    remain -= canGive;
  }

  return transactions;
}

// -------------------------
// 4. Emparejar deudores y acreedores para transacciones
// -------------------------
function minimizeTransactions(balances) {
  let debtors = balances
    .filter(b => b.balance < 0)
    .map(d => ({ name: d.name, balance: Math.abs(d.balance) }));

  let creditors = balances
    .filter(b => b.balance > 0)
    .map(c => ({ name: c.name, balance: c.balance }));

  const transactions = [];

  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    // La cantidad a transferir es el mínimo de lo que debe y lo que se le debe
    const amount = Math.min(debtor.balance, creditor.balance);

    transactions.push({
      from: debtor.name,
      to: creditor.name,
      amount: parseFloat(amount.toFixed(2))
    });

    // Ajustamos sus saldos en las sublistas
    debtor.balance -= amount;
    creditor.balance -= amount;

    // Ajustamos en balances original
    // Deudor
    const debtorIndex = balances.findIndex(b => b.name === debtor.name);
    balances[debtorIndex].balance += (amount * -1);

    // Acreedor
    const creditorIndex = balances.findIndex(b => b.name === creditor.name);
    balances[creditorIndex].balance -= amount;

    // Si el deudor ya pagó, pasamos al siguiente
    if (debtor.balance === 0) i++;
    // Si el acreedor ya cobró, pasamos al siguiente
    if (creditor.balance === 0) j++;
  }

  return transactions;
}

// -------------------------
// 5. Renderizado de resultados (sin balance final)
// -------------------------
function renderResults(balances, totalAportaciones, totalSpent, sobrante, leftoverTransactions, payTransactions, costoPorPersona) {
    let html = '';

    html += `<p><strong>Total aportado (real):</strong> ${totalAportaciones.toFixed(2)}</p>`;
    html += `<p><strong>Total gastado:</strong> ${totalSpent.toFixed(2)}</p>`;
    html += `<p><strong>A cada uno le toca (reparto equitativo):</strong> ${costoPorPersona.toFixed(2)}</p>`;
    html += `<p><strong>Sobrante (inicial):</strong> ${sobrante.toFixed(2)}</p>`;

    // 1. Tabla de reparto de sobrante
    if (leftoverTransactions.length > 0) {
      html += `<h3>1) Quién coge cuánto del sobrante</h3>`;
      html += `<table><thead><tr><th>De</th><th>A</th><th>Monto</th></tr></thead><tbody>`;
      leftoverTransactions.forEach(t => {
        html += `<tr><td>${t.from}</td><td>${t.to}</td><td>${t.amount}</td></tr>`;
      });
      html += `</tbody></table>`;
    } else if (sobrante > 0) {
      // sobrante > 0 y no se generaron transacciones => no había nadie con balance positivo
      html += `<p><strong>Nota:</strong> Sobró dinero, pero nadie tenía que recibir.</p>`;
    } else {
      html += `<p>No hubo reparto de sobrante.</p>`;
    }

    // 2. Tabla de transacciones finales (quién paga a quién)
    if (payTransactions.length > 0) {
      html += `<h3>2) Después de eso, quién debe cuánto a quién</h3>`;
      html += `<table><thead><tr><th>Quién paga</th><th>A quién</th><th>Monto</th></tr></thead><tbody>`;
      payTransactions.forEach(t => {
        html += `<tr><td>${t.from}</td><td>${t.to}</td><td>${t.amount}</td></tr>`;
      });
      html += `</tbody></table>`;
    } else {
      html += `<p>No hay pagos pendientes entre personas (nadie debe a nadie).</p>`;
    }

    // Nota aclaratoria
    html += `
      <p style="color:#999; font-size:0.9rem;">
        <strong>Detalles:</strong><br/>
        1) Primero se reparte el sobrante a quienes tienen balance positivo, de menor a mayor,
        reduciendo sus balances. <br/>
        2) Luego se calculan las transacciones entre quienes aún tengan saldo negativo y saldo positivo. <br/>
        De esta forma, ves dos tablas separadas:
        <ul>
          <li><em>"Quién coge cuánto del sobrante"</em></li>
          <li><em>"Quién debe cuánto a quién"</em></li>
        </ul>
      </p>
    `;

    resultContainer.innerHTML = html;
  }
