const express = require('express');
const app = express();

app.get('/', (req, res) => {
    const htmlString = `
<!DOCTYPE html>
<html>
<body>

<h1>Under Construction</h1>

<img src="https://cdn.sumomo.horse/misc/unsu-true.jpg" alt="Seiun Sky" width="256" height="256">

</body>
</html>`;
    res.send(htmlString)

});

app.listen(3000, () => console.log('App running on port 3000'));
