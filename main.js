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

// Parse contract text to extract key data (basic starter for your shown format)
function parseContractData(text) {
    const data = {};
    // Simple regexes for sample fields
    data.registration = (text.match(/Registration:\s*([A-Z$0-9\. ]+)/) || [])[1] || "";
    data.defaultPayout = (text.match(/Default Payout\s*([A-Z$0-9\. ]+)/) || [])[1] || "";
    data.actionLocking = (text.match(/Action Locking\s*([A-Za-z0-9 ,\(\)\.]+)/) || [])[1] || "";
    data.invoicing = (text.match(/Invoicing\s*([A-Za-z0-9 ,\(\)\.]+)/) || [])[1] || "";
    data.payoutScheduling = (text.match(/Payout Scheduling\s*([A-Za-z0-9 ,\(\)\.]+)/) || [])[1] || "";
    data.creditPolicy = (text.match(/Credit Policy\s*([A-Za-z0-9 ,\(\)\.]+)/) || [])[1] || "";
    data.referralWindow = (text.match(/Referral Window\s*([A-Za-z0-9 ,\(\)\.]+)/) || [])[1] || "";

    // Payout Groups extraction (very basic, you may need to improve for your real data!)
    const payoutGroupRegex = /Condition\s*Payout([\s\S]*?)(?:Free Trial|$)/;
    const match = text.match(payoutGroupRegex);
    data.payoutGroups = [];
    if (match) {
        const rows = match[1].split(/\d+\s+/).filter(Boolean);
        rows.forEach(row => {
            const condition = (row.match(/Customer Status is [\w ]+ Referral SharedId is \d+/) || [])[0] || "";
            const payout = (row.match(/US\$[0-9\.]+ per order/) || [])[0] || "";
            if (condition || payout) data.payoutGroups.push({ condition, payout });
        });
    }
    return data;
}

// Compare two contract data objects
function compareContracts(data1, data2) {
    let html = "<table class='diff-table'><tr><th>Field</th><th>Contract 1</th><th>Contract 2</th></tr>";
    const fields = ["registration", "defaultPayout", "actionLocking", "invoicing", "payoutScheduling", "creditPolicy", "referralWindow"];
    fields.forEach(field => {
        const diffClass = (data1[field] !== data2[field]) ? "diff-different" : "";
        html += `<tr class="${diffClass}"><td>${field.replace(/([A-Z])/g, ' $1')}</td><td>${data1[field]}</td><td>${data2[field]}</td></tr>`;
    });
    // Payout Groups comparison (shows side-by-side)
    html += `<tr><td>Payout Groups</td><td>${data1.payoutGroups.map(pg => pg.condition + ": " + pg.payout).join("<br>")}</td><td>${data2.payoutGroups.map(pg => pg.condition + ": " + pg.payout).join("<br>")}</td></tr>`;
    html += "</table>";
    return html;
}

// UI handlers
document.getElementById('compareBtn').onclick = async function() {
    const file1 = document.getElementById('pdf1').files[0];
    const file2 = document.getElementById('pdf2').files[0];
    if (!file1 || !file2) {
        alert("Please choose two PDF files to compare.");
        return;
    }
    document.getElementById('result').innerHTML = "Extracting and comparing...";
    try {
        const [text1, text2] = await Promise.all([extractTextFromPDF(file1), extractTextFromPDF(file2)]);
        const data1 = parseContractData(text1);
        const data2 = parseContractData(text2);
        const differences = compareContracts(data1, data2);
        document.getElementById('result').innerHTML = differences;
    } catch (err) {
        document.getElementById('result').innerHTML = "Error: " + err;
    }
};