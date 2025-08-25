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
        // --- STEP 1: Parse both contracts ---
        const oldData = parseContract(oldText);
        const newData = parseContract(newText);

        // --- STEP 2: Compare payout groups by keys ---
        const payoutSections = ["Free Trial", "Online Sale"];
        const payoutChanges = [];

        payoutSections.forEach(section => {
            const oldGroups = oldData[section + "_Groups"] || [];
            const newGroups = newData[section + "_Groups"] || [];

            // Build a map from condition key to payout group for easy matching
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

            // Find all unique keys
            const allKeys = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);

            allKeys.forEach(key => {
                const oldG = oldMap[key] || {};
                const newG = newMap[key] || {};

                const oldPayout = oldG.Payout || "";
                const newPayout = newG.Payout || "";

                if (oldPayout !== newPayout) {
                    let payoutDiff = "";
                    // Try to extract numbers for $ diff
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

        // Basic Information (unchanged, but you can extend as needed)
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

        // Key Terms (optional; can be expanded for more fields)
        const keyTerms = [];

        // Build summary
        const summary = `Found ${payoutChanges.length} payout changes (matched by key conditions).`;
        const significantChanges = payoutChanges.map(
            p => `${p.section}: ${p.condition}: ${p.oldValue} → ${p.newValue} ${p.change}`
        );

        const minorChanges = basicInformation.filter(i=>i.change==="Changed").map(i => `${i.aspect}: ${i.oldValue} → ${i.newValue}`);

        return {
            summary,
            significantChanges,
            minorChanges,
            basicInformation,
            keyTerms,
            payoutChanges,
            questions: []
        };
    }

    function extractValue(payoutStr) {
        // Extract numeric dollar value from strings like "US$18.00 per order"
        const match = payoutStr.match(/US\$([\d,.]+)/);
        return match ? parseFloat(match[1].replace(/,/g, '')) : null;
    }

    // Parses contract text into a JS object with major aspects and payout groups
    function parseContract(text) {
        const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
        const data = {};
        let section = '';
        let payoutGroups = [];
        let currentGroup = {};
        let inPayoutGroups = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Find major sections
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

            // Parse payout groups
            if (line === "Payout Groups") {
                payoutGroups = [];
                inPayoutGroups = true;
                continue;
            }
            if (inPayoutGroups && (/^\d+$/.test(line) || line === "All Other")) {
                // Save previous group if exists
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
                // End of a group: if next line is blank or next group starts
                if (i+1 >= lines.length || /^\d+$/.test(lines[i+1]) || lines[i+1] === "All Other" || lines[i+1] === "Schedule") {
                    if (Object.keys(currentGroup).length > 0) {
                        payoutGroups.push(currentGroup);
                        currentGroup = {};
                    }
                }
            }
            // End of payout groups section
            if (inPayoutGroups && line === "Schedule") {
                inPayoutGroups = false;
                if (section && payoutGroups.length > 0) data[section + "_Groups"] = payoutGroups;
                payoutGroups = [];
            }
        }
        // Push last group if exists
        if (inPayoutGroups && Object.keys(currentGroup).length > 0) payoutGroups.push(currentGroup);
        if (section && payoutGroups.length > 0) data[section + "_Groups"] = payoutGroups;

        return data;
    }

    // Renders results as HTML
    function displayResults(comparison) {
        resultsArea.innerHTML = `
            <h3>Summary of Changes</h3>
            <p>${comparison.summary}</p>
            <h4>Significant Changes:</h4>
            <ul>
                ${comparison.significantChanges.map(change => `<li>${change}</li>`).join('')}
            </ul>
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
                ${comparison.basicInformation.map(info => `
                    <tr>
                        <td>${info.aspect}</td>
                        <td>${info.oldValue}</td>
                        <td class="${info.change === 'Changed' ? 'highlight' : ''}">${info.newValue}</td>
                    </tr>
                `).join('')}
            </table>
            ${comparison.payoutChanges.length > 0 ? `
                <h3>Payout Changes</h3>
                <table class="comparison-table">
                    <tr>
                        <th>Section</th>
                        <th>Condition</th>
                        <th>Old Payout</th>
                        <th>New Payout</th>
                        <th>Change</th>
                    </tr>
                    ${comparison.payoutChanges.map(change => `
                        <tr>
                            <td>${change.section}</td>
                            <td>${change.condition}</td>
                            <td>${change.oldValue}</td>
                            <td class="highlight">${change.newValue}</td>
                            <td class="highlight">${change.change}</td>
                        </tr>
                    `).join('')}
                </table>
            ` : ''}
        `;
    }
});
