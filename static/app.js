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
    try {
        // Only use the two remaining canvases
        const breakdownCanvas = document.getElementById('breakdownChart');
        const balanceAndInterestCanvas = document.getElementById('balanceAndInterestChart');
        const ctx2 = breakdownCanvas?.getContext('2d');
        const ctx3 = balanceAndInterestCanvas?.getContext('2d');
        if (!window.Chart) {
            console.error('Chart.js is not loaded.');
            return;
        }
        if (!ctx2 || !ctx3) {
            console.error('One or more canvas elements not found or context not available.');
            return;
        }
        // Destroy existing charts if they exist
        const chart2 = Chart.getChart(breakdownCanvas);
        if (chart2) chart2.destroy();
        const chart3 = Chart.getChart(balanceAndInterestCanvas);
        if (chart3) chart3.destroy();
        const labels = schedule.map(row => row.payment_number);
        const balances = schedule.map(row => row.balance);
        const principals = schedule.map(row => row.principal);
        const interests = schedule.map(row => row.interest);
        // Calculate cumulative interest
        let cumulativeInterest = [];
        let total = 0;
        for (let i = 0; i < interests.length; i++) {
            total += interests[i];
            cumulativeInterest.push(Number(total.toFixed(2)));
        }
        new Chart(ctx3, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Remaining Principal',
                        data: balances,
                        borderColor: 'blue',
                        fill: false
                    },
                    {
                        label: 'Cumulative Interest Paid',
                        data: cumulativeInterest,
                        borderColor: 'orange',
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'Principal & Cumulative Interest Over Time' }
                }
            }
        });
        new Chart(ctx2, {
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
    } catch (err) {
        console.error('Error drawing charts:', err);
    }
}
