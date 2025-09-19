let lastFormData = null;
let lastOriginalResult = null;
let currencySymbol = '$';

document.getElementById('loan-form').onsubmit = async function(e) {
    e.preventDefault();
    const form = e.target;
    const data = new FormData(form);
    lastFormData = new FormData(form); // Save for reuse
    try {
        const response = await fetch('/calculate', {
            method: 'POST',
            body: data
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Backend error:', response.status, errorText);
            alert('An error occurred: ' + response.status + '\n' + errorText);
            return;
        }
        const result = await response.json();
        currencySymbol = result.currency_symbol || '$';
        lastOriginalResult = result.result.original;
        displaySummary(result.result.original.summary, 'Summary', currencySymbol);
        displaySchedule(result.result.original.schedule, currencySymbol);
        drawCharts(result.result.original.schedule, null);
        // Show custom repayment section
        document.getElementById('custom-repayment-section').style.display = 'block';
        document.getElementById('custom-summary').innerHTML = '';
        document.getElementById('custom-repayment-input').value = '';
    } catch (err) {
        console.error('Network or JS error:', err);
        alert('A network or application error occurred. See console for details.');
    }
};

// Handle custom repayment button
const customBtn = document.getElementById('custom-repayment-btn');
if (customBtn) {
    customBtn.onclick = async function() {
        if (!lastFormData) return;
        const customValue = parseFloat(document.getElementById('custom-repayment-input').value);
        if (!customValue || customValue <= 0) {
            document.getElementById('custom-summary').innerHTML = '<span style="color:red">Enter a valid custom repayment amount.</span>';
            return;
        }
        // Prepare new form data
        const data = new FormData();
        for (let [k, v] of lastFormData.entries()) data.append(k, v);
        data.append('custom_repayment', customValue);
        try {
            const response = await fetch('/calculate', {
                method: 'POST',
                body: data
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Backend error:', response.status, errorText);
                alert('An error occurred: ' + response.status + '\n' + errorText);
                return;
            }
            const result = await response.json();
            currencySymbol = result.currency_symbol || '$';
            if (!result.result.custom) {
                document.getElementById('custom-summary').innerHTML = '<span style="color:red">Custom repayment must be greater than the minimum monthly payment.</span>';
                return;
            }
            displaySummary(result.result.custom.summary, 'Custom Repayment', currencySymbol);
            displaySchedule(result.result.custom.schedule, currencySymbol);
            displayCustomSummary(result.result.difference, result.result.original.summary, result.result.custom.summary, currencySymbol);
            drawCharts(result.result.original.schedule, result.result.custom.schedule);
        } catch (err) {
            console.error('Network or JS error:', err);
            alert('A network or application error occurred. See console for details.');
        }
    };
}

function displaySummary(summary, label = 'Summary', symbol = '$') {
    document.getElementById('summary').innerHTML = `
        <h2>${label}</h2>
        <p><strong>Monthly Repayment:</strong> ${symbol}${summary.monthly_payment.toLocaleString()}</p>
        <p><strong>Total Payments:</strong> ${symbol}${summary.total_payments.toLocaleString()}</p>
        <p><strong>Total Interest Paid:</strong> ${symbol}${summary.total_interest.toLocaleString()}</p>
        <p><strong>Payoff Date:</strong> ${summary.payoff_date}</p>
    `;
}

function displayCustomSummary(diff, orig, custom, symbol = '$') {
    if (!diff) return;
    document.getElementById('custom-summary').innerHTML = `
        <h3>Comparison</h3>
        <p><strong>Difference in Total Payments:</strong> ${symbol}${diff.total_payments_diff.toLocaleString()}</p>
        <p><strong>Months Saved:</strong> ${diff.months_diff}</p>
        <p><strong>Original Payoff Date:</strong> ${orig.payoff_date}</p>
        <p><strong>Custom Payoff Date:</strong> ${custom.payoff_date}</p>
    `;
}

function displaySchedule(schedule, symbol = '$') {
    let html = '<h2>Amortization Schedule</h2><table><tr><th>#</th><th>Date</th><th>Payment</th><th>Principal</th><th>Interest</th><th>Balance</th></tr>';
    schedule.forEach(row => {
        html += `<tr><td>${row.payment_number}</td><td>${row.date}</td><td>${symbol}${row.payment.toFixed(2)}</td><td>${symbol}${row.principal.toFixed(2)}</td><td>${symbol}${row.interest.toFixed(2)}</td><td>${symbol}${row.balance.toFixed(2)}</td></tr>`;
    });
    html += '</table>';
    document.getElementById('schedule').innerHTML = html;
    showDownloadButton();
}

// Show the download button after schedule is generated
function showDownloadButton() {
    console.log('showDownloadButton called');
    document.getElementById('download-excel-btn').style.display = 'block';
}

// Hide the download button
function hideDownloadButton() {
    document.getElementById('download-excel-btn').style.display = 'none';
}

function drawCharts(originalSchedule, customSchedule) {
    try {
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
        // Prepare data for original
        const labels = originalSchedule.map(row => row.payment_number);
        const balances = originalSchedule.map(row => row.balance);
        let cumulativeInterest = [];
        let total = 0;
        for (let i = 0; i < originalSchedule.length; i++) {
            total += originalSchedule[i].interest;
            cumulativeInterest.push(Number(total.toFixed(2)));
        }
        // Prepare data for custom if present
        let customBalances = [], customCumulativeInterest = [], customLabels = [];
        if (customSchedule) {
            customLabels = customSchedule.map(row => row.payment_number);
            customBalances = customSchedule.map(row => row.balance);
            let cTotal = 0;
            for (let i = 0; i < customSchedule.length; i++) {
                cTotal += customSchedule[i].interest;
                customCumulativeInterest.push(Number(cTotal.toFixed(2)));
            }
        }
        // Line chart: Principal & Cumulative Interest Over Time
        new Chart(ctx3, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Original Remaining Principal',
                        data: balances,
                        borderColor: 'blue',
                        fill: false
                    },
                    {
                        label: 'Original Cumulative Interest Paid',
                        data: cumulativeInterest,
                        borderColor: 'orange',
                        fill: false
                    },
                    ...(customSchedule ? [
                        {
                            label: 'Custom Remaining Principal',
                            data: customBalances,
                            borderColor: 'green',
                            borderDash: [5,5],
                            fill: false
                        },
                        {
                            label: 'Custom Cumulative Interest Paid',
                            data: customCumulativeInterest,
                            borderColor: 'red',
                            borderDash: [5,5],
                            fill: false
                        }
                    ] : [])
                ],
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'Principal & Cumulative Interest Over Time' }
                }
            }
        });
        // Bar chart: Principal/Interest breakdown (original only)
        const principals = originalSchedule.map(row => row.principal);
        const interests = originalSchedule.map(row => row.interest);
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

// Add event listener for download button
const downloadBtn = document.getElementById('download-excel-btn');
if (downloadBtn) {
    downloadBtn.onclick = async function() {
        // Gather form data
        const form = document.getElementById('loan-form');
        const data = new FormData(form);
        // Add custom repayment if present
        const customVal = document.getElementById('custom-repayment-input').value;
        if (customVal) data.append('custom_repayment', customVal);
        // Get chart images as base64
        const chart1 = document.getElementById('balanceAndInterestChart').toDataURL('image/png');
        const chart2 = document.getElementById('breakdownChart').toDataURL('image/png');
        data.append('chart1_base64', chart1);
        data.append('chart2_base64', chart2);
        try {
            const response = await fetch('/download_excel', {
                method: 'POST',
                body: data
            });
            if (!response.ok) {
                const errorText = await response.text();
                alert('Failed to generate Excel file: ' + errorText);
                return;
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'amortization.xlsx';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert('An error occurred while downloading the Excel file.');
            console.error(err);
        }
    };
}

window.onload = function() {
    hideDownloadButton();
    // ...any other onload logic...
};
