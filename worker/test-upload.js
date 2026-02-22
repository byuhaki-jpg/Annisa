const fs = require('fs');
fs.writeFileSync('test.jpg', 'dummy image content');
const formData = new FormData();
formData.append('file', new Blob([fs.readFileSync('test.jpg')]), 'test.jpg');
fetch('https://kostannisa-worker.fikriabdulloh31.workers.dev/api/expenses/scan-ai', {
  method: 'POST',
  body: formData
}).then(r => r.text()).then(console.log).catch(console.error);
