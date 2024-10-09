const express = require('express');
const router = express.Router();
const Product = require('../models/Product');


router.get('/fetchAllProducts', async (req, res) => {
    try {
        const products = await Product.find({});
        res.json(products);
    } catch (error) {
        console.log(error.message);
        res.status(500).send("Internal server error occured");
    }
})


router.get('/stats/:month', async (req, res) => {
    const month = parseInt(req.params.month); // Get the month from the request parameters

    try {
        const totalSaleAmount = await Product.aggregate([
            { $match: { $expr: { $eq: [{ $month: "$dateOfSale" }, month] } } },
            { $group: { _id: null, totalAmount: { $sum: "$price" } } },
            { $project: { _id: 0, totalAmount: { $round: ["$totalAmount", 2] } } } // Round to 2 decimal places
        ]);

        const totalSoldItems = await Product.countDocuments({
            $expr: { $eq: [{ $month: "$dateOfSale" }, month] },
            sold: true
        });

        const totalNotSoldItems = await Product.countDocuments({
            $expr: { $eq: [{ $month: "$dateOfSale" }, month] },
            sold: false
        });

        res.json({
            totalSaleAmount: totalSaleAmount[0]?.totalAmount || 0,
            totalSoldItems,
            totalNotSoldItems
        });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Server error');
    }
});

router.get('/price-range/:month', async (req, res) => {
    const month = parseInt(req.params.month); // Get the month from the request parameters

    try {
        // Log the requested month
        console.log('Requested Month:', month);

        const priceRanges = await Product.aggregate([
            {
                $match: {
                    $expr: {
                        $eq: [{ $month: "$dateOfSale" }, month]
                    }
                }
            },
            {
                $bucket: {
                    groupBy: "$price",
                    boundaries: [1, 101, 201, 301, 401, 501, 601, 701, 801, 901, Infinity], // Adjust the boundaries to match the requirement
                    default: "901-above",
                    output: {
                        numberOfItems: { $sum: 1 }
                    }
                }
            }
        ]);

        console.log('Price Ranges:', priceRanges); // Log the output of the aggregation

        // Define all possible ranges
        const allRanges = [
            { priceRange: "1-100", numberOfItems: 0 },
            { priceRange: "101-200", numberOfItems: 0 },
            { priceRange: "201-300", numberOfItems: 0 },
            { priceRange: "301-400", numberOfItems: 0 },
            { priceRange: "401-500", numberOfItems: 0 },
            { priceRange: "501-600", numberOfItems: 0 },
            { priceRange: "601-700", numberOfItems: 0 },
            { priceRange: "701-800", numberOfItems: 0 },
            { priceRange: "801-900", numberOfItems: 0 },
            { priceRange: "901-above", numberOfItems: 0 }
        ];

        // Map the aggregation results to the predefined ranges
        priceRanges.forEach(range => {
            let rangeLabel = '';
            if (range._id === "901-above") {
                rangeLabel = "901-above";
            } else {
                const lowerBound = range._id;
                const upperBound = lowerBound === 901 ? 'above' : lowerBound + 99;
                rangeLabel = `${lowerBound}-${upperBound}`;
            }
            const index = allRanges.findIndex(r => r.priceRange === rangeLabel);
            if (index !== -1) {
                allRanges[index].numberOfItems = range.numberOfItems;
            }
        });

        res.json(allRanges);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Server error');
    }
});

router.get('/search', async (req, res) => {
    const { searchText, month } = req.query; // Get parameters from the request query

    // Validate month
    if (!month || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).send('A valid month (1-12) is required in the query');
    }

    // Convert searchText to number if applicable
    const searchNumber = !isNaN(searchText) ? Number(searchText) : null;

    // Prepare base search criteria for the specified month
    const monthCriteria = {
        $expr: {
            $eq: [{ $month: "$dateOfSale" }, Number(month)]
        }
    };

    // Prepare search criteria based on searchText
    let searchCriteria = {};

    if (searchText) {
        searchCriteria = {
            $or: [
                { title: { $regex: searchText, $options: 'i' } },
                { description: { $regex: searchText, $options: 'i' } },
                { category: { $regex: searchText, $options: 'i' } }
            ]
        };

        // Add price search if applicable
        if (searchNumber !== null) {
            searchCriteria.$or.push({ price: searchNumber });
        }
    }

    try {
        // Query combining month and search criteria
        const query = {
            $and: [
                monthCriteria,
                ...(searchText ? [searchCriteria] : [])
            ]
        };

        const products = await Product.find(query);

        // If products are found, return them
        if (products.length > 0) {
            return res.json(products);
        }

        // If no products found for the search criteria, return all for the specified month
        const allProductsForMonth = await Product.find(monthCriteria);
        return res.json(allProductsForMonth);

    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Server error');
    }
});

router.get('/categories/:month', async (req, res) => {
    const { month } = req.params;

    // Validate month
    if (!month || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({ error: 'A valid month (1-12) is required in the parameters' });
    }

    try {
        // Aggregation pipeline to group by category and count items
        const categoriesData = await Product.aggregate([
            {
                // Match documents where the month of dateOfSale matches the provided month
                $match: {
                    $expr: {
                        $eq: [{ $month: "$dateOfSale" }, Number(month)]
                    }
                }
            },
            {
                // Group by category and count the number of items in each category
                $group: {
                    _id: "$category",
                    numberOfItems: { $sum: 1 } // Change here
                }
            },
            {
                // Optionally, sort the results by number of items in descending order
                $sort: { numberOfItems: -1 } // Change here
            }
        ]);

        // Format the response
        const formattedCategoriesData = categoriesData.map(item => ({
            category: item._id,
            numberOfItems: item.numberOfItems // Change here
        }));

        return res.json(formattedCategoriesData);

    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/combined-data/:month', async (req, res) => {
    const month = parseInt(req.params.month);

    try {
        const transactions = await Product.find({
            $expr: {
                $eq: [{ $month: "$dateOfSale" }, month]
            }
        });

        const totalSaleAmount = transactions.reduce((total, transaction) => total + transaction.price, 0);

        // Count sold and not sold items
        const totalSoldItems = transactions.filter(transaction => transaction.sold).length;
        const totalNotSoldItems = transactions.length - totalSoldItems; // Total items minus sold items

        const priceRanges = await Product.aggregate([
            { $match: { $expr: { $eq: [{ $month: "$dateOfSale" }, month] } } },
            {
                $bucket: {
                    groupBy: "$price",
                    boundaries: [1, 101, 201, 301, 401, 501, 601, 701, 801, 901, Infinity],
                    default: "901-above",
                    output: {
                        numberOfItems: { $sum: 1 }
                    }
                }
            }
        ]);

        const categories = await Product.aggregate([
            { $match: { $expr: { $eq: [{ $month: "$dateOfSale" }, month] } } },
            { $group: { _id: "$category", numberOfItems: { $sum: 1 } } },
            { $sort: { numberOfItems: -1 } }
        ]);

        res.json({
            transactions,
            stats: {
                totalAmount: totalSaleAmount,
                totalSoldItems: totalSoldItems,
                totalNotSoldItems: totalNotSoldItems
            },
            priceRanges,
            categories: categories.map(item => ({
                category: item._id,
                numberOfItems: item.numberOfItems
            }))
        });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Server error');
    }
});




module.exports = router;
