document.addEventListener('DOMContentLoaded', () => {
    const compareButton = document.getElementById('compareButton');
    const resultsArea = document.getElementById('results');
    const loadingBar = document.getElementById('loadingBar');
    const loadingProgress = loadingBar.querySelector('.loading-progress');

    compareButton.addEventListener('click', () => {
        const oldContract = document.getElementById('oldContract').value;
        const newContract = document.getElementById('newContract').value;

        // Show loading bar animation
        loadingBar.style.display = 'block';
        loadingProgress.style.width = '0%';
        let progress = 0;
        const interval = setInterval(() => {
            progress += 2;
            loadingProgress.style.width = `${Math.min(progress, 90)}%`;
        }, 60);

        setTimeout(() => {
            clearInterval(interval);
            loadingProgress.style.width = '100%';
            setTimeout(() => {
                loadingBar.style.display = 'none';
                try {
                    const comparison = compareContracts(oldContract, newContract);
                    displayResults(comparison);
                } catch (e) {
                    resultsArea.innerHTML = `<p class="highlight">Error parsing contracts: ${e.message}</p>`;
                }
            }, 350);
        }, 1200);
    });

    function compareContracts(oldText, newText) {
        const oldData = parseContract(oldText);
        const newData = parseContract(newText);

        const payoutSections = ["Free Trial", "Online Sale"];
        const payoutChanges = [];

        payoutSections.forEach(section => {
            const oldGroups = oldData[section + "_Groups"] || [];
            const newGroups = newData[section + "_Groups"] || [];

            const groupKey = g =>
                [
                    g["Customer Status"] || "",
                    g["Referral SharedId"] || "",
                    g["Item Category"] || "",
                    g["Currency"] || "",
                    g["Condition"] || ""
                ].filter(Boolean).join('|');

            const oldMap = Object.fromEntries(oldGroups.map(g => [groupKey(g), g]));
            const newMap = Object.fromEntries(newGroups.map(g => [groupKey(g), g]));

            const allKeys = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);

            allKeys.forEach(key => {
                const oldG = oldMap[key] || {};
                const newG = newMap[key] || {};

                const oldPayout = oldG.Payout || "";
                const newPayout = newG.Payout || "";

                if (oldPayout !== newPayout) {
                    let payoutDiff = "";
                    const oldVal = extractValue(oldPayout);
                    const newVal = extractValue(newPayout);
                    if (oldVal !== null && newVal !== null && oldVal !== newVal) {
                        const diff = newVal - oldVal;
                        payoutDiff = `(${diff > 0 ? "+" : ""}$${diff.toFixed(2)} change)`;
                    }
                    payoutChanges.push({
                        section,
                        condition: key.replace(/\|/g, ", "),
                        oldValue: oldPayout,
                        newValue: newPayout,
                        change: `Changed from ${oldPayout || 'none'} to ${newPayout || 'none'} ${payoutDiff}`
                    });
                }
            });
        });

        const aspects = [
            "Registration",
            "Action Locking",
            "Invoicing",
            "Payout Scheduling",
            "Credit Policy",
            "Referral Window"
        ];

        const basicInformation = aspects.map(aspect => ({
            aspect,
            oldValue: oldData[aspect] || '',
            newValue: newData[aspect] || '',
            change: (oldData[aspect] || '') !== (newData[aspect] || '') ? "Changed" : "No change"
        }));

        const keyTerms = [];

        const summary = `Found <span class="highlight">${payoutChanges.length}</span> payout changes <span style="font-weight:normal;">(matched by key conditions).</span>`;

        // For table rendering, significantChanges is just payoutChanges
        return {
            summary,
            significantChanges: payoutChanges,
            minorChanges: basicInformation.filter(i=>i.change==="Changed").map(i => `<span class="highlight">${i.aspect}</span>: <span>${i.oldValue}</span> → <span class="highlight">${i.newValue}</span>`),
            basicInformation,
            keyTerms,
            payoutChanges,
            questions: []
        };
    }

    function extractValue(payoutStr) {
        const match = payoutStr.match(/US\$([\d,.]+)/);
        return match ? parseFloat(match[1].replace(/,/g, '')) : null;
    }

    function parseContract(text) {
        const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
        const data = {};
        let section = '';
        let payoutGroups = [];
        let currentGroup = {};
        let inPayoutGroups = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith("Free Trial:")) {
                section = "Free Trial";
                payoutGroups = [];
                inPayoutGroups = false;
            }
            if (line.startsWith("Online Sale:")) {
                section = "Online Sale";
                payoutGroups = [];
                inPayoutGroups = false;
            }
            if (line.startsWith("Registration:")) data["Registration"] = line.split(':')[1].trim();
            if (line.startsWith("Action Locking")) data["Action Locking"] = line;
            if (line.startsWith("Invoicing")) data["Invoicing"] = line;
            if (line.startsWith("Payout Scheduling")) data["Payout Scheduling"] = line;
            if (line.startsWith("Credit Policy")) data["Credit Policy"] = line;
            if (line.startsWith("Referral Window")) data["Referral Window"] = line;

            if (line === "Payout Groups") {
                payoutGroups = [];
                inPayoutGroups = true;
                continue;
            }
            if (inPayoutGroups && (/^\d+$/.test(line) || line === "All Other")) {
                if (Object.keys(currentGroup).length > 0) {
                    payoutGroups.push(currentGroup);
                    currentGroup = {};
                }
                if (line === "All Other") {
                    currentGroup = { Condition: "All Other" };
                }
                continue;
            }
            if (inPayoutGroups) {
                if (line.startsWith("Customer Status")) currentGroup["Customer Status"] = line.split('is ')[1];
                if (line.startsWith("Referral SharedId")) currentGroup["Referral SharedId"] = line.split('is ')[1];
                if (line.startsWith("Item Category")) currentGroup["Item Category"] = line.split('is ')[1];
                if (line.startsWith("Currency is")) currentGroup["Currency"] = line.split('is ')[1];
                if (/^US\$[\d,.]+/.test(line) || /^\d+%/.test(line) || line.includes('per order') || line.includes('sale amount')) {
                    currentGroup["Payout"] = line;
                }
                if (i+1 >= lines.length || /^\d+$/.test(lines[i+1]) || lines[i+1] === "All Other" || lines[i+1] === "Schedule") {
                    if (Object.keys(currentGroup).length > 0) {
                        payoutGroups.push(currentGroup);
                        currentGroup = {};
                    }
                }
            }
            if (inPayoutGroups && line === "Schedule") {
                inPayoutGroups = false;
                if (section && payoutGroups.length > 0) data[section + "_Groups"] = payoutGroups;
                payoutGroups = [];
            }
        }
        if (inPayoutGroups && Object.keys(currentGroup).length > 0) payoutGroups.push(currentGroup);
        if (section && payoutGroups.length > 0) data[section + "_Groups"] = payoutGroups;

        return data;
    }

    // Significant changes table rendering
    function renderSignificantChangesTable(changes) {
        if (!changes.length) return "<p>No significant changes.</p>";
        return `
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th>Section</th>
                        <th>Condition</th>
                        <th>Old Payout</th>
                        <th>New Payout</th>
                        <th>Change</th>
                    </tr>
                </thead>
                <tbody>
                ${changes.map(change => `
                    <tr>
                        <td>${change.section}</td>
                        <td>${change.condition}</td>
                        <td>${change.oldValue}</td>
                        <td class="highlight">${change.newValue}</td>
                        <td class="highlight">${change.change}</td>
                    </tr>
                `).join('')}
                </tbody>
            </table>
        `;
    }

function displayResults(comparison) {
    // Filter only aspects with changes
    const changedBasics = comparison.basicInformation.filter(info => info.change === 'Changed');

    resultsArea.innerHTML = `
        <h3>Summary of Changes</h3>
        <p>${comparison.summary}</p>
        <h4>Significant Changes:</h4>
        ${renderSignificantChangesTable(comparison.significantChanges)}
        <h4>Minor Changes:</h4>
        <ul>
            ${comparison.minorChanges.map(change => `<li>${change}</li>`).join('')}
        </ul>
        <h3>Basic Information Changes</h3>
        <table class="comparison-table">
            <tr>
                <th>Aspect</th>
                <th>Old Contract</th>
                <th>New Contract</th>
            </tr>
            ${
                changedBasics.length === 0
                ? `<tr><td colspan="3" style="text-align:center;color:#888;">No changes detected in basic information.</td></tr>`
                : changedBasics.map(info => `
                    <tr>
                        <td>${info.aspect}</td>
                        <td>${info.oldValue}</td>
                        <td class="highlight">${info.newValue}</td>
                    </tr>
                `).join('')
            }
        </table>
    `;
}
});
