// Extract text from PDF using PDF.js
async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        // Each item.str is a text fragment; join with space, then add newline at end of page for best results
        fullText += content.items.map(item => item.str).join(" ") + "\n";
    }
    return fullText;
}

// Compare line by line and return only changed lines
function compareContractsLineByLine(oldText, newText) {
    // Split into lines and trim whitespace
    const oldLines = oldText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const newLines = newText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    const maxLines = Math.max(oldLines.length, newLines.length);
    let changes = [];

    for (let i = 0; i < maxLines; i++) {
        const oldLine = oldLines[i] || '';
        const newLine = newLines[i] || '';
        if (oldLine !== newLine) {
            // Try to highlight the exact changed substring
            let changeDescription = "";
            // If both have a monetary value, highlight that difference
            const oldAmount = oldLine.match(/US\$[0-9\.,]+/);
            const newAmount = newLine.match(/US\$[0-9\.,]+/);
            if (oldAmount && newAmount && oldAmount[0] !== newAmount[0]) {
                changeDescription = `Amount changed from <b>${oldAmount[0]}</b> to <b>${newAmount[0]}</b>`;
            } else {
                changeDescription = "Line changed";
            }
            changes.push({
                aspect: `Line ${i+1}`,
                oldValue: oldLine,
                newValue: newLine,
                change: changeDescription
            });
        }
    }
    return changes;
}

// Display only changed lines in a table
function displayLineByLineChanges(changes) {
    const resultsArea = document.getElementById('results');
    if (changes.length === 0) {
        resultsArea.innerHTML = "<p>No differences found!</p>";
        return;
    }
    let html = `
        <h3>Line-by-Line Changes</h3>
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
                const changes = compareContractsLineByLine(oldText, newText);
                displayLineByLineChanges(changes);
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
