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

        // --- STEP 2: Compare parsed data ---
        // Basic Information
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

        // Key Terms (e.g., Free Trial, Online Sale payout groups)
        const keyTerms = [];
        ["Free Trial", "Online Sale"].forEach(section => {
            const oldGroups = oldData[section + "_Groups"] || [];
            const newGroups = newData[section + "_Groups"] || [];
            // Compare each group by rank and condition
            for (let i = 0; i < Math.max(oldGroups.length, newGroups.length); i++) {
                const oldG = oldGroups[i] || {};
                const newG = newGroups[i] || {};
                keyTerms.push({
                    aspect: section + " Group " + (i + 1),
                    oldValue: formatGroup(oldG),
                    newValue: formatGroup(newG),
                    change: JSON.stringify(oldG) !== JSON.stringify(newG) ? "Changed" : "No change"
                });
            }
        });

        // Payouts
        const payoutChanges = [];
        // Compare payout groups for Free Trial and Online Sale
        ["Free Trial", "Online Sale"].forEach(section => {
            const oldGroups = oldData[section + "_Groups"] || [];
            const newGroups = newData[section + "_Groups"] || [];
            for (let i = 0; i < Math.max(oldGroups.length, newGroups.length); i++) {
                const oldG = oldGroups[i] || {};
                const newG = newGroups[i] || {};
                const condition = (oldG.Condition || newG.Condition || '') + (oldG["Referral SharedId"] ? ` (SharedId ${oldG["Referral SharedId"]})` : '');
                if ((oldG.Payout || '') !== (newG.Payout || '')) {
                    payoutChanges.push({
                        condition,
                        oldValue: oldG.Payout || '',
                        newValue: newG.Payout || '',
                        change: `Changed from ${oldG.Payout || 'none'} to ${newG.Payout || 'none'}`
                    });
                }
            }
        });

        // Find summary and questions
        const summary = `Compared contracts. Found ${basicInformation.filter(i=>i.change==="Changed").length} basic changes, ${keyTerms.filter(i=>i.change==="Changed").length} key term changes, and ${payoutChanges.length} payout changes.`;
        const significantChanges = payoutChanges.map(p => `${p.condition}: ${p.change}`);
        const minorChanges = basicInformation.filter(i=>i.change==="Changed").map(i => `${i.aspect}: ${i.oldValue} → ${i.newValue}`);

        // Questions (stub for future extension)
        const questions = [];

        return {
            summary,
            significantChanges,
            minorChanges,
            basicInformation,
            keyTerms,
            payoutChanges,
            questions
        };
    }

    // Parses contract text into a JS object with major aspects and payout groups
    function parseContract(text) {
        const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
        const data = {};
        let section = '';
        let payoutGroups = [];
        let currentGroup = {};

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Find major sections
            if (line.startsWith("Free Trial:")) section = "Free Trial";
            if (line.startsWith("Online Sale:")) section = "Online Sale";
            if (line.startsWith("Registration:")) data["Registration"] = line.split(':')[1].trim();
            if (line.startsWith("Action Locking")) data["Action Locking"] = line;
            if (line.startsWith("Invoicing")) data["Invoicing"] = line;
            if (line.startsWith("Payout Scheduling")) data["Payout Scheduling"] = line;
            if (line.startsWith("Credit Policy")) data["Credit Policy"] = line;
            if (line.startsWith("Referral Window")) data["Referral Window"] = line;

            // Parse payout groups
            if (line === "Payout Groups") {
                payoutGroups = [];
                section = section || "General";
                continue;
            }
            if (/^\d+$/.test(line)) {
                currentGroup = {};
                continue;
            }
            if (line.startsWith("Customer Status")) currentGroup["Condition"] = line;
            if (line.startsWith("Referral SharedId")) currentGroup["Referral SharedId"] = line.split(' ')[3];
            if (line.startsWith("Item Category")) currentGroup["Condition"] = (currentGroup["Condition"] || "") + ", " + line;
            if (/^\US\$/.test(line) || /^\d+%/.test(line) || line.includes('per order') || line.includes('sale amount')) {
                currentGroup["Payout"] = line;
            }
            if (Object.keys(currentGroup).length > 0 && line === "") {
                payoutGroups.push(currentGroup);
                currentGroup = {};
            }
            if (line === "All Other") {
                currentGroup = { Condition: "All Other" };
                continue;
            }
        }
        // Push last group if exists
        if (Object.keys(currentGroup).length > 0) payoutGroups.push(currentGroup);

        // Attach payout groups to section
        if (section && payoutGroups.length > 0) data[section + "_Groups"] = payoutGroups;

        return data;
    }

    function formatGroup(group) {
        return Object.entries(group).map(([k,v]) => `${k}: ${v}`).join(", ");
    }

    // Renders results as HTML (adapted from your example)
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
            <h3>Key Terms Changes</h3>
            <table class="comparison-table">
                <tr>
                    <th>Aspect</th>
                    <th>Old Contract</th>
                    <th>New Contract</th>
                    <th>Change</th>
                </tr>
                ${comparison.keyTerms.map(term => `
                    <tr>
                        <td>${term.aspect}</td>
                        <td>${term.oldValue}</td>
                        <td class="${term.change === 'Changed' ? 'highlight' : ''}">${term.newValue}</td>
                        <td>${term.change}</td>
                    </tr>
                `).join('')}
            </table>
            ${comparison.payoutChanges.length > 0 ? `
                <h3>Payout Changes</h3>
                <table class="comparison-table">
                    <tr>
                        <th>Condition</th>
                        <th>Old Payout</th>
                        <th>New Payout</th>
                        <th>Change</th>
                    </tr>
                    ${comparison.payoutChanges.map(change => `
                        <tr>
                            <td>${change.condition}</td>
                            <td>${change.oldValue}</td>
                            <td class="highlight">${change.newValue}</td>
                            <td class="highlight">${change.change}</td>
                        </tr>
                    `).join('')}
                </table>
            ` : ''}
            ${comparison.questions.length > 0 ? `
                <h3>Questions for Clarification</h3>
                <ul>
                    ${comparison.questions.map(q => `<li>${q}</li>`).join('')}
                </ul>
            ` : ''}
        `;
    }
});
