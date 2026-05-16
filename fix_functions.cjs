const fs = require('fs');
let content = fs.readFileSync('firebase_functions/index.js', 'utf8');

// Update model name
content = content.replace(/model: "gemini-2\.5-flash"/g, 'model: "gemini-1.5-flash"');
content = content.replace(/model: "gemini-2\.5-pro"/g, 'model: "gemini-1.5-pro"');

// Update prompt enum values
content = content.replace(/\(양호, 주의, 위험 중 택 1\)/g, '(정상, 주의, 경고 중 택 1)');

// Update response handling
content = content.replace(/const resultText = response\.text;/g, 'const resultText = response.response ? response.response.text() : (typeof response.text === "function" ? response.text() : (response.text || "{}"));');

fs.writeFileSync('firebase_functions/index.js', content);
console.log('Successfully updated firebase_functions/index.js');
