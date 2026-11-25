const fs = require('fs');
const path = require('path');

const css = fs.readFileSync('styles.css', 'utf8');
let html = fs.readFileSync('index.html', 'utf8');

// Replace the CSS link with inline styles
html = html.replace('<link rel="stylesheet" href="styles.css">', `<style>\n${css}\n</style>`);


                        
// Remove the external app.js link
html = html.replace('<script src="app.js"></script>', '');

const jsContent = fs.readFileSync('new_app.js', 'utf8');

html = html.replace('</body>', `<script>\n${jsContent}\n</script>\n</body>`);

fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/index.html', html);
console.log('Built public/index.html successfully.');
