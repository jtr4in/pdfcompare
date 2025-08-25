# Impact Radius Contract Comparator

A simple web app to compare two PDF contracts from Impact Radius, highlighting differences in key fields.  
Runs entirely in your browser, suitable for hosting via GitHub Pages.

## How to Use

1. Upload two contract PDFs using the file inputs.
2. Click **Compare**.
3. See a table showing any differences between the contracts.

## Tech Stack

- HTML/CSS/JS (no backend)
- [PDF.js](https://mozilla.github.io/pdf.js/) for PDF text extraction

## Customization

- The contract parser in `main.js` is set up for the format shown in your sample.  
  You may need to modify regexes and logic if your contract PDFs use a different format.

## Hosting

- Host this repo via GitHub Pages for easy online access.

## License

MIT (or your choice)