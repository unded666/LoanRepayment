document.getElementById('loan-form').onsubmit = async function(e) {
    e.preventDefault();
    const form = e.target;
    const data = new FormData(form);
    const response = await fetch('/calculate', {
        method: 'POST',
        body: data
    });
    const result = await response.json();
    displaySummary(result.summary);
    displaySchedule(result.schedule);
    drawCharts(result.schedule);
};

function displaySummary(summary) {
    document.getElementById('summary').innerHTML = `
        <h2>Summary</h2>
        <p><strong>Total Payments:</strong> $${summary.total_payments.toLocaleString()}</p>
        <p><strong>Total Interest Paid:</strong> $${summary.total_interest.toLocaleString()}</p>
        <p><strong>Payoff Date:</strong> ${summary.payoff_date}</p>
    `;
}

function displaySchedule(schedule) {
    let html = '<h2>Amortization Schedule</h2><table><tr><th>#</th><th>Date</th><th>Payment</th><th>Principal</th><th>Interest</th><th>Balance</th></tr>';
    schedule.forEach(row => {
        html += `<tr><td>${row.payment_number}</td><td>${row.date}</td><td>$${row.payment.toFixed(2)}</td><td>$${row.principal.toFixed(2)}</td><td>$${row.interest.toFixed(2)}</td><td>$${row.balance.toFixed(2)}</td></tr>`;
    });
    html += '</table>';
    document.getElementById('schedule').innerHTML = html;
}

function drawCharts(schedule) {
    const ctx1 = document.getElementById('balanceChart').getContext('2d');
    const ctx2 = document.getElementById('breakdownChart').getContext('2d');
    const labels = schedule.map(row => row.payment_number);
    const balances = schedule.map(row => row.balance);
    const principals = schedule.map(row => row.principal);
    const interests = schedule.map(row => row.interest);
    if(window.balanceChart) window.balanceChart.destroy();
    if(window.breakdownChart) window.breakdownChart.destroy();
    window.balanceChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Remaining Balance',
                data: balances,
                borderColor: 'blue',
                fill: false
            }]
        },
        options: { responsive: true }
    });
    window.breakdownChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Principal',
                    data: principals,
                    backgroundColor: 'green',
                },
                {
                    label: 'Interest',
                    data: interests,
                    backgroundColor: 'red',
                }
            ]
        },
        options: { responsive: true, stacked: true }
    });
}

