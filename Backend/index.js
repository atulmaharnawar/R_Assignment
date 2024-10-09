require('dotenv').config()
const connectToMongo = require("./db");
const express = require('express')
const cors = require('cors');

connectToMongo();

const app = express()
const port = 5000

app.use(cors());
app.use(express.json());

app.get('/', (req,resp) => {
    resp.send("Home!");
})

app.use('/api', require('./routes/products'));

app.listen(port, () => {
    console.log(`iNoteBook backend app listening at http://localhost:${port}`)
})