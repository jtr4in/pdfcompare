async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map(item => item.str).join(" ") + "\n";
    }
    return fullText;
}

// Extract payout lines in the expected format
function extractPayoutLines(text) {
    // Match lines with Customer Status, Referral SharedId, and payout
    return text.match(/Customer Status.*?Referral SharedId is \d+ US\$[\d\.,]+ per order/g) || [];
}

// Compare payouts by SharedId and show changes only
function comparePayoutLines(oldLines, newLines) {
    // Helper: extract SharedId from line
    function getSharedId(line) {
        const match = line.match(/Referral SharedId is (\d+)/);
        return match ? match[1] : null;
    }
    // Helper: extract payout value
    function getPayout(line) {
        const match = line.match(/US\$[\d\.,]+/);
        return match ? match[0] : "";
    }

    // Build lookup by SharedId
    const oldMap = Object.fromEntries(oldLines.map(l => [getSharedId(l), l]));
    const newMap = Object.fromEntries(newLines.map(l => [getSharedId(l), l]));

    let changes = [];
    Object.keys(newMap).forEach(sharedId => {
        const oldLine = oldMap[sharedId] || "";
        const newLine = newMap[sharedId];
        const oldPayout = getPayout(oldLine);
        const newPayout = getPayout(newLine);

        if (oldPayout !== newPayout) {
            changes.push({
                aspect: `Referral SharedId ${sharedId}`,
                oldValue: oldPayout ? `${oldPayout}` : "(not present)",
                newValue: newPayout ? `${newPayout}` : "(not present)",
                change: `Payout changed from <b>${oldPayout || "(none)"}</b> to <b>${newPayout || "(none)"}</b>`
            });
        }
    });
    return changes;
}

// Display payout changes in a concise table
function displayPayoutChanges(changes) {
    const resultsArea = document.getElementById('results');
    if (changes.length === 0) {
        resultsArea.innerHTML = "<p>No payout differences found!</p>";
        return;
    }
    let html = `
        <h3>Payout Changes</h3>
        <table class="comparison-table">
            <tr>
                <th>Aspect</th>
                <th>Old Payout</th>
                <th>New Payout</th>
                <th>Change</th>
            </tr>
            ${changes.map(row => `
                <tr>
                    <td>${row.aspect}</td>
                    <td>${row.oldValue}</td>
                    <td class="highlight">${row.newValue}</td>
                    <td>${row.change}</td>
                </tr>
            `).join('')}
        </table>
    `;
    resultsArea.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
    const compareButton = document.getElementById('compareButton');
    const loadingBar = document.getElementById('loadingBar');
    const loadingProgress = loadingBar.querySelector('.loading-progress');

    compareButton.addEventListener('click', async () => {
        const oldFile = document.getElementById('oldContract').files[0];
        const newFile = document.getElementById('newContract').files[0];
        const resultsArea = document.getElementById('results');

        if (!oldFile || !newFile) {
            resultsArea.innerHTML = "<p>Please select both contracts to compare.</p>";
            return;
        }

        // Show loading bar
        loadingBar.style.display = 'block';
        loadingProgress.style.width = '0%';
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 1;
            loadingProgress.style.width = `${Math.min(progress, 90)}%`;
        }, 100);

        try {
            const [oldText, newText] = await Promise.all([
                extractTextFromPDF(oldFile),
                extractTextFromPDF(newFile)
            ]);

            clearInterval(progressInterval);
            loadingProgress.style.width = '100%';

            setTimeout(() => {
                // Extract only payout lines
                const oldLines = extractPayoutLines(oldText);
                const newLines = extractPayoutLines(newText);
                const changes = comparePayoutLines(oldLines, newLines);
                displayPayoutChanges(changes);
                loadingBar.style.display = 'none';
            }, 500);

        } catch (error) {
            clearInterval(progressInterval);
            loadingBar.style.display = 'none';
            resultsArea.innerHTML = `
                <p>An error occurred: ${error.message}</p>
                <pre>${error.stack || ''}</pre>
            `;
        }
    });
});
