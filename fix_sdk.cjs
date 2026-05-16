const fs = require('fs');
let content = fs.readFileSync('firebase_functions/index.js', 'utf8');

// Update analyzeSafetyPhoto to use standard Google AI SDK pattern
const oldFunction = /const ai = getGeminiClient\(\);[\s\S]*?const resultText = response\.response \? response\.response\.text\(\) : \(typeof response\.text === \"function\" \? response\.text\(\) : \(response\.text \|\| \"{}\"\)\);/g;

const newFunction = `const ai = getGeminiClient();
    const model = ai.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: imageBase64, mimeType: mimeType } }
    ]);
    
    const response = await result.response;
    const resultText = response.text();`;

content = content.replace(oldFunction, newFunction);

fs.writeFileSync('firebase_functions/index.js', content);
console.log('Successfully updated firebase_functions/index.js to use standard SDK pattern');
