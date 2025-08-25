// Extract text from PDF using PDF.js
async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map(item => item.str).join(" ");
    }
    return fullText;
}

// Basic contract diff for demo purposes
function compareText(oldText, newText) {
    const linesOld = oldText.split(/\n|\r/).map(l => l.trim()).filter(Boolean);
    const linesNew = newText.split(/\n|\r/).map(l => l.trim()).filter(Boolean);

    let changes = [];
    let changedCount = 0;

    // Naive line-by-line comparison
    for (let i = 0; i < Math.max(linesOld.length, linesNew.length); i++) {
        const oldLine = linesOld[i] || '';
        const newLine = linesNew[i] || '';
        let changeType = 'No change';
        if (oldLine !== newLine) {
            changeType = 'Changed';
            changedCount++;
        }
        changes.push({
            aspect: `Line ${i+1}`,
            oldValue: oldLine,
            newValue: newLine,
            change: changeType
        });
    }

    // Summary
    let summary = changedCount === 0
        ? "No changes found."
        : `${changedCount} lines changed.`;

    return {
        summary,
        significantChanges: changes.filter(c => c.change === 'Changed').map(c => `Line ${c.aspect}: "${c.oldValue}" → "${c.newValue}"`),
        minorChanges: [],
        basicInformation: changes.slice(0, 10), // first 10 lines for demo
        keyTerms: changes.slice(10, 20), // next 10 lines for demo
        payoutChanges: [],
        questions: changedCount > 0 ? ["Review all highlighted lines for contract impact."] : []
    };
}

document.addEventListener('DOMContentLoaded', () => {
    const compareButton = document.getElementById('compareButton');
    const resultsArea = document.getElementById('results');
    const loadingBar = document.getElementById('loadingBar');
    const loadingProgress = loadingBar.querySelector('.loading-progress');

    compareButton.addEventListener('click', async () => {
        const oldFile = document.getElementById('oldContract').files[0];
        const newFile = document.getElementById('newContract').files[0];

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
                const comparison = compareText(oldText, newText);
                displayResults(comparison);
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

    function displayResults(comparison) {
        resultsArea.innerHTML = `
            <h3>Summary of Changes</h3>
            <p>${comparison.summary}</p>
            <h4>Significant Changes:</h4>
            <ul>${comparison.significantChanges.map(change => `<li>${change}</li>`).join('')}</ul>
            <h4>Minor Changes:</h4>
            <ul>${comparison.minorChanges.map(change => `<li>${change}</li>`).join('')}</ul>
            <h3>Basic Information Changes</h3>
            <table class="comparison-table">
                <tr>
                    <th>Aspect</th><th>Old Contract</th><th>New Contract</th><th>Change</th>
                </tr>
                ${comparison.basicInformation.map(info => `
                    <tr>
                        <td>${info.aspect}</td>
                        <td>${info.oldValue}</td>
                        <td class="${info.oldValue !== info.newValue ? 'highlight' : ''}">${info.newValue}</td>
                        <td>${info.change}</td>
                    </tr>
                `).join('')}
            </table>
            <h3>Key Terms Changes</h3>
            <table class="comparison-table">
                <tr>
                    <th>Aspect</th><th>Old Contract</th><th>New Contract</th><th>Change</th>
                </tr>
                ${comparison.keyTerms.map(term => `
                    <tr>
                        <td>${term.aspect}</td>
                        <td>${term.oldValue}</td>
                        <td class="${term.oldValue !== term.newValue ? 'highlight' : ''}">${term.newValue}</td>
                        <td>${term.change}</td>
                    </tr>
                `).join('')}
            </table>
            ${comparison.questions.length > 0 ? `
                <h3>Questions for Clarification</h3>
                <ul>${comparison.questions.map(q => `<li>${q}</li>`).join('')}</ul>
            ` : ''}
        `;
    }
});
