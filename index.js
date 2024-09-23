const express = require('express');

const { ConnectionPool } = require('mssql'); // Use mssql package for SQL Server
const cors = require('cors');
const path = require('path');
const sql = require('mssql');

const port = process.env.PORT || 3000;


// Initialize express app
const app = express();


// Azure SQL Server connection configuration
const pool = new ConnectionPool({
  user: 'urbanwada', // Update with your SQL Server username
  password: 'Admin@1845', // Update with your SQL Server password
  server: 'urbanwada.database.windows.net', // Azure SQL Server address
  database: 'urbanwada', // Your database name
  options: {
    encrypt: true, // Required for Azure
    enableArithAbort: true,
  },
});

// Attempt to connect to the Azure SQL database
pool.connect()
  .then(() => console.log('Connected to the database'))
  .catch(err => console.error('Database connection failed: ', err));

app.use(express.json());
app.use(cors());

// Serve static files (images and videos)
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/videos', express.static(path.join(__dirname, 'public/videos')));





// List of category IDs to hide
const hiddenCategoryIds = [25, 26];

// Fetch products grouped by category
app.get('/products-by-category', async (req, res, next) => {
  try {
    const result = await pool.request().query(`
      SELECT c.id AS category_id, c.name AS category_name, p.id AS product_id, 
             p.name AS product_name, p.price, p.discount_price, 
             p.image_url, p.product_video
      FROM Categories c
      LEFT JOIN Products p ON c.id = p.category_id
      ORDER BY c.id, p.id
    `);

    const categories = {};
    result.recordset.forEach(row => {
      if (hiddenCategoryIds.includes(row.category_id)) return;

      if (!categories[row.category_id]) {
        categories[row.category_id] = {
          name: row.category_name,
          products: [],
        };
      }

      if (row.product_id) {
        categories[row.category_id].products.push({
          id: row.product_id,
          name: row.product_name,
          price: row.price,
          discount_price: row.discount_price,
          image_url: row.image_url,
          product_video: row.product_video,
        });
      }
    });

    res.json(categories);
  } catch (err) {
    next(err);
  }
});
// Fetch product details by product ID
app.get('/products/details/:id', async (req, res, next) => {
  const productId = parseInt(req.params.id);
  if (isNaN(productId)) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }

  try {
    let pool = await sql.connect(dbConfig);
    const productResult = await pool.request()
      .input('productId', sql.Int, productId)
      .query(`
        SELECT id, name, price, discount_price, image_url, product_code, product_video, rate_per, contents_per, description, category_id
        FROM Products WHERE id = @productId
      `);

    if (productResult.recordset.length > 0) {
      const product = productResult.recordset[0];

      const relatedProductsResult = await pool.request()
        .input('categoryId', sql.Int, product.category_id)
        .input('productId', sql.Int, productId)
        .query(`
          SELECT id, name, price, discount_price, image_url
          FROM Products 
          WHERE category_id = @categoryId AND id != @productId
        `);

      res.json({
        product,
        relatedProducts: relatedProductsResult.recordset,
      });
    } else {
      res.status(404).send('Product not found');
    }
  } catch (error) {
    next(error);
  }
});


// Fetch product details by product ID
app.get('/products-by-category/:categoryId', async (req, res, next) => {
  const categoryId = parseInt(req.params.categoryId);
  if (isNaN(categoryId)) {
    return res.status(400).json({ error: 'Invalid category ID' });
  }

  try {
    const result = await pool.request()
      .input('categoryId', sql.Int, categoryId)
      .query(`
        SELECT id, name, price, discount_price, image_url, product_details, product_video, product_specification, product_code, rate_per, contents_per, description
        FROM Products WHERE category_id = @categoryId
      `);
    res.json(result.recordset);
  } catch (err) {
    next(err);
  }
});

// Fetch categories
app.get('/categories', async (req, res, next) => {
  try {
    const result = await pool.request().query('SELECT * FROM Categories ORDER BY name');
    res.json(result.recordset);
  } catch (err) {
    next(err);
  }
});

// Fetch products by selected category
app.get('/products-by-category/:categoryId', async (req, res, next) => {
  const categoryId = parseInt(req.params.categoryId);
  if (isNaN(categoryId)) {
    return res.status(400).json({ error: 'Invalid category ID' });
  }

  try {
    const result = await pool.request()
      .input('categoryId', categoryId)
      .query(`
        SELECT id, name, price, discount_price, image_url, product_details, product_video, product_specification, product_code, rate_per, contents_per, description
        FROM Products WHERE category_id = @categoryId
      `);
    res.json(result.recordset);
  } catch (err) {
    next(err);
  }
});

// Search products by query
app.get('/search-products', async (req, res, next) => {
  const searchQuery = req.query.searchQuery;
  if (!searchQuery) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const result = await pool.request()
      .input('searchQuery', `%${searchQuery}%`)
      .query(`
        SELECT id, name, price, discount_price, image_url, product_details, product_video, product_specification, product_code, rate_per, contents_per, description
        FROM Products WHERE name LIKE @searchQuery
      `);
    res.json(result.recordset);
  } catch (err) {
    next(err);
  }
});

// Add new product
app.post('/api/products', async (req, res, next) => {
  const {
    name,
    price,
    discount_price,
    image_url,
    product_details,
    product_video,
    category_id,
    product_specification,
    product_code,
    rate_per,
    contents_per,
    description,
  } = req.body;

  try {
    const result = await pool.request()
      .input('name', name)
      .input('price', price)
      .input('discount_price', discount_price)
      .input('image_url', image_url)
      .input('product_details', product_details)
      .input('product_video', product_video)
      .input('category_id', category_id)
      .input('product_specification', product_specification)
      .input('product_code', product_code)
      .input('rate_per', rate_per)
      .input('contents_per', contents_per)
      .input('description', description)
      .query(`
        INSERT INTO Products (name, price, discount_price, image_url, product_details, product_video, category_id, product_specification, product_code, rate_per, contents_per, description)
        VALUES (@name, @price, @discount_price, @image_url, @product_details, @product_video, @category_id, @product_specification, @product_code, @rate_per, @contents_per, @description);
        SELECT SCOPE_IDENTITY() AS id;
      `);
    res.status(201).json({ id: result.recordset[0].id });
  } catch (error) {
    next(error);
  }
});

// Update product
app.put('/products/:id', async (req, res, next) => {
  const { id } = req.params;
  const {
    name,
    price,
    discount_price,
    image_url,
    product_details,
    product_video,
    product_specification,
    product_code,
    rate_per,
    contents_per,
    description,
  } = req.body;

  try {
    // Perform the update
    await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('price', sql.Decimal, price)
      .input('discount_price', sql.Decimal, discount_price)
      .input('image_url', sql.NVarChar, image_url)
      .input('product_details', sql.NVarChar, product_details)
      .input('product_video', sql.NVarChar, product_video)
      .input('product_specification', sql.NVarChar, product_specification)
      .input('product_code', sql.NVarChar, product_code)
      .input('rate_per', sql.NVarChar, rate_per)
      .input('contents_per', sql.NVarChar, contents_per)
      .input('description', sql.NVarChar, description)
      .query(`
        UPDATE Products
        SET name = @name, price = @price, discount_price = @discount_price, image_url = @image_url, 
            product_details = @product_details, product_video = @product_video, 
            product_specification = @product_specification, product_code = @product_code, 
            rate_per = @rate_per, contents_per = @contents_per, description = @description
        WHERE id = @id;
      `);

    // Retrieve the updated record
    const updatedProduct = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM Products WHERE id = @id');

    if (updatedProduct.recordset.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(updatedProduct.recordset[0]);
  } catch (err) {
    next(err);
  }
});



// Delete product
app.delete('/products/:id', async (req, res, next) => {
  const { id } = req.params;

  try {
    const result = await pool.request()
      .input('id', id)
      .query('DELETE FROM Products WHERE id = @id');

    if (result.rowsAffected[0] > 0) {
      res.json({ message: 'Product deleted successfully' });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (err) {
    next(err);
  }
});

// Add new category
app.post('/add-category', async (req, res, next) => {
  const { name } = req.body;

  try {
    // Perform the INSERT operation and return the inserted category
    const result = await pool.request()
      .input('name', name)
      .query(`
        INSERT INTO Categories (name)
        OUTPUT inserted.id, inserted.name
        VALUES (@name)
      `);

    // Send back the inserted category information
    res.json({
      message: 'Category added successfully',
      category: result.recordset[0],
    });
  } catch (err) {
    next(err);
  }
});


// Update category
// Node.js with mssql package
app.put('/update-category/:id', async (req, res, next) => {
  const categoryId = parseInt(req.params.id);
  const { name } = req.body;

  try {
    const result = await pool.request()
      .input('name', name)
      .input('categoryId', categoryId)
      .query('UPDATE Categories SET name = @name WHERE id = @categoryId; SELECT * FROM Categories WHERE id = @categoryId');

    if (result.recordset.length > 0) {
      res.json({ message: 'Category updated successfully', category: result.recordset[0] });
    } else {
      res.status(404).json({ message: 'Category not found' });
    }
  } catch (err) {
    console.error('Database error:', err);
    next(err);
  }
});

// Delete category
app.delete('/delete-category/:id', async (req, res, next) => {
  const categoryId = parseInt(req.params.id);

  try {
    const result = await pool.request()
      .input('categoryId', categoryId)
      .query('DELETE FROM Categories WHERE id = @categoryId');

    if (result.rowsAffected[0] > 0) {
      res.json({ message: 'Category deleted successfully' });
    } else {
      res.status(404).json({ message: 'Category not found' });
    }
  } catch (err) {
    next(err);
  }
});

// ** Serve React App Build **
app.use(express.static(path.join(__dirname, 'Frontend/anilshop/build')));

// All other routes should serve the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'Frontend/anilshop/build', 'index.html'));
});



// Start the server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
