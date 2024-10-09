const axios = require('axios');
const connectDB = require('./db');
const Product = require('./models/Product');

const fetchDataAndInsert = async () => {
    try {
        await connectDB(); 

        const response = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
        const products = response.data.map(product => ({
            id: product.id,
            title: product.title,
            price: product.price,
            description: product.description,
            category: product.category,
            image: product.image,
            sold: product.sold,
            dateOfSale: product.dateOfSale
        }));

        const result = await Product.insertMany(products);
        console.log('Products inserted:', result);

        // await mongoose.disconnect();
        // console.log('Disconnected from MongoDB');
    } catch (err) {
        console.error('Error:', err);
    }
};

fetchDataAndInsert();
