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

    // Flexible contract parser for large contracts
    function parseContract(text) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const data = {};
        let currentSection = '';
        let payoutGroups = [];
        let currentGroup = {};
        let inPayoutGroups = false;
        let aspect = '';
        let aspects = {};

        // Aspects to extract
        const aspectKeys = [
            'Action Locking',
            'Payout Scheduling',
            'Credit Policy',
            'Referral Window',
            'Invoicing',
            'Qualified Referrals',
            'Registration'
        ];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Detect section headers (e.g., Disney+ Android App : purchaseCompleted: $10.00-$20.00 USD)
            if (/^[\w\+\s\.\-]+:.*\$[\d\.]+.*USD$/.test(line) || /^[\w\+\s\.\-]+:.*\$[\d\.]+.*$/.test(line)) {
                currentSection = line.split(':')[0].trim();
                data[currentSection] = { payoutGroups: [], aspects: {} };
                inPayoutGroups = false;
                aspects = {};
                continue;
            }

            // Detect start of payout groups
            if (/^Payout Groups$/i.test(line) || /^Default Payout$/i.test(line)) {
                payoutGroups = [];
                inPayoutGroups = true;
                continue;
            }

            // End payout groups at "Schedule" or similar
            if (/^Schedule$/i.test(line) || /^Payout Restrictions$/i.test(line)) {
                inPayoutGroups = false;
                if (currentSection && payoutGroups.length > 0) {
                    data[currentSection].payoutGroups = payoutGroups;
                }
                payoutGroups = [];
                continue;
            }

            // Parse payout group
            if (inPayoutGroups) {
                if (line === 'All Other') {
                    if (Object.keys(currentGroup).length > 0) payoutGroups.push(currentGroup);
                    currentGroup = { Condition: 'All Other' };
                    continue;
                }
                if (/^(Item SKU|Item Subtotal|Referral SharedId|Customer Country\/Region) is/.test(line)) {
                    const [key, value] = line.split(' is ');
                    currentGroup[key.trim()] = value.trim();
                    continue;
                }
                if (/^US\$[\d,.]+/.test(line) || /^\d+%/.test(line) || line.includes('per order') || line.includes('sale amount') || line === 'none') {
                    currentGroup['Payout'] = line;
                    payoutGroups.push(currentGroup);
                    currentGroup = {};
                    continue;
                }
            }

            // Parse aspects (find aspect header, then next line is its value)
            if (aspectKeys.some(a => line.startsWith(a))) {
                aspect = aspectKeys.find(a => line.startsWith(a));
                if (lines[i + 1] && !aspectKeys.some(a => lines[i + 1].startsWith(a)) && lines[i + 1] !== aspect) {
                    aspects[aspect] = lines[i + 1].trim();
                } else {
                    aspects[aspect] = line.replace(aspect, '').trim() || aspect;
                }
                data[currentSection] = data[currentSection] || { payoutGroups: [], aspects: {} };
                data[currentSection].aspects = { ...data[currentSection].aspects, ...aspects };
                aspect = '';
                continue;
            }

            // Registration aspect special handling (sometimes just a value)
            if (line.startsWith('Registration')) {
                let val = line.split(':')[1];
                if (!val) val = lines[i + 1] || '';
                aspects['Registration'] = val.trim();
                data[currentSection] = data[currentSection] || { payoutGroups: [], aspects: {} };
                data[currentSection].aspects = { ...data[currentSection].aspects, ...aspects };
            }
        }
        // Push any last payout group
        if (inPayoutGroups && Object.keys(currentGroup).length > 0) payoutGroups.push(currentGroup);
        if (currentSection && payoutGroups.length > 0) data[currentSection].payoutGroups = payoutGroups;

        return data;
    }

    function extractValue(payoutStr) {
        const match = payoutStr.match(/US\$([\d,.]+)/);
        return match ? parseFloat(match[1].replace(/,/g, '')) : null;
    }

    // Compare contracts for changes
    function compareContracts(oldText, newText) {
        const oldData = parseContract(oldText);
        const newData = parseContract(newText);

        const allSections = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]));
        const payoutChanges = [];

        allSections.forEach(section => {
            const oldGroups = (oldData[section] && oldData[section].payoutGroups) || [];
            const newGroups = (newData[section] && newData[section].payoutGroups) || [];

            // Create key for group matching
            const groupKey = g =>
                ['Item SKU', 'Item Subtotal', 'Referral SharedId', 'Customer Country/Region', 'Condition']
                    .map(k => g[k] || '').filter(Boolean).join('|');

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

        // Basic Info comparison
        const aspectKeys = [
            'Registration',
            'Action Locking',
            'Invoicing',
            'Payout Scheduling',
            'Credit Policy',
            'Referral Window'
        ];
        const basicInformation = [];
        aspectKeys.forEach(aspect => {
            let oldVal = '';
            let newVal = '';
            // Try to find aspect value from any section (first found)
            for (const sec of allSections) {
                if (oldData[sec] && oldData[sec].aspects && oldData[sec].aspects[aspect]) {
                    oldVal = oldData[sec].aspects[aspect];
                    break;
                }
            }
            for (const sec of allSections) {
                if (newData[sec] && newData[sec].aspects && newData[sec].aspects[aspect]) {
                    newVal = newData[sec].aspects[aspect];
                    break;
                }
            }
            basicInformation.push({
                aspect,
                oldValue: oldVal,
                newValue: newVal,
                change: oldVal !== newVal ? "Changed" : "No change"
            });
        });

        // Minor changes are just aspects that changed
        const minorChanges = basicInformation.filter(i => i.change === "Changed").map(i =>
            `<span class="highlight">${i.aspect}</span>: <span>${i.oldValue}</span> → <span class="highlight">${i.newValue}</span>`
        );

        const summary = `Found <span class="highlight">${payoutChanges.length}</span> payout changes <span style="font-weight:normal;">(matched by key conditions).</span>`;

        return {
            summary,
            significantChanges: payoutChanges,
            minorChanges,
            basicInformation,
        };
    }

    // Table rendering for significant changes
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

    // Table rendering for basic information changes
    function renderBasicInformationTable(basicInformation) {
        const changedBasics = basicInformation.filter(info => info.change === 'Changed');
        // If nothing changed, show "No changes detected"
        if (changedBasics.length === 0) {
            return `
                <table class="comparison-table">
                    <tr>
                        <th>Aspect</th>
                        <th>Old Contract</th>
                        <th>New Contract</th>
                    </tr>
                    <tr>
                        <td colspan="3" style="text-align:center;color:#888;">No changes detected in basic information.</td>
                    </tr>
                </table>
            `;
        }
        return `
            <table class="comparison-table">
                <tr>
                    <th>Aspect</th>
                    <th>Old Contract</th>
                    <th>New Contract</th>
                </tr>
                ${changedBasics.map(info => `
                    <tr>
                        <td>${info.aspect}</td>
                        <td>${info.oldValue}</td>
                        <td class="highlight">${info.newValue}</td>
                    </tr>
                `).join('')}
            </table>
        `;
    }

    function displayResults(comparison) {
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
            ${renderBasicInformationTable(comparison.basicInformation)}
        `;
    }
});
