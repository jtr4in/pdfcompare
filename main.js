// Extract text from PDF using PDF.js
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

// Extract payout lines
function extractPayoutLines(text) {
    // This regex matches lines with Referral SharedId and payout amount
    return text.match(/Customer Status.*?Referral SharedId.*?US\$[\d\.,]+ per order/g) || [];
}

// Compare payout lines by Referral SharedId
function comparePayoutLines(oldLines, newLines) {
    // Build lookup by Referral SharedId for each contract
    function getSharedId(line) {
        const match = line.match(/Referral SharedId is (\d+)/);
        return match ? match[1] : null;
    }
    let changes = [];
    const oldMap = Object.fromEntries(oldLines.map(l => [getSharedId(l), l]));
    const newMap = Object.fromEntries(newLines.map(l => [getSharedId(l), l]));

    // Compare by SharedId
    Object.keys(newMap).forEach(sharedId => {
        const oldLine = oldMap[sharedId] || "";
        const newLine = newMap[sharedId];
        if (oldLine !== newLine) {
            // extract payout values
            const oldVal = oldLine.match(/US\$[\d\.,]+/)?.[0] || "";
            const newVal = newLine.match(/US\$[\d\.,]+/)?.[0] || "";
            let changeText = "";
            if (oldVal && newVal && oldVal !== newVal) {
                changeText = `Payout changed from <b>${oldVal}</b> to <b>${newVal}</b>`;
            } else {
                changeText = "Line changed";
            }
            changes.push({
                aspect: `SharedId ${sharedId}`,
                oldValue: oldLine,
                newValue: newLine,
                change: changeText
            });
        }
    });
    return changes;
}

// Display payout changes
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
                <th>Old Contract</th>
                <th>New Contract</th>
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
                // Extract payout lines
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
