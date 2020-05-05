const formidable = require('formidable');
const _ = require('lodash');
const fs = require('fs');
const Product = require('../models/product');
const {errorHandler} = require('../helpers/dbErrorHandler');

exports.productById = (req, res, next, id) => {
	Product.findById(id)
	.populate("category")
	.exec((err, product) => {
		if(err || !product) {
			return res.status(400).json({
				error: "Item not found"
			});
		}
		req.product = product;
		next();
	});
};

exports.read = (req, res) =>{
	req.product.photo = undefined;
	return res.json(req.product);
};

exports.create = (req, res) => {
	let form = new formidable.IncomingForm();
	form.keepExtensions = true;
	form.parse(req, (err, fields, files) => {
		if(err) {
			return res.status(400).json({
				error: 'Cannot upload image'
			});
		}
		// field check
		const {name, description, price, category, quantity, shipping} = fields;

		if(!name || !description || !price || !category || !quantity || !shipping) {
			return res.status(400).json({
				error: "You must specify all fields"
			});
		}

		let product = new Product(fields);

		if(files.photo) {
			if(files.photo.size > 1000000)	{	// size over 1 mb
				return res.status.json({
					error: "Image must be smaller than 1mb"
				});
			}
			product.photo.data = fs.readFileSync(files.photo.path);
			product.photo.contentType = files.photo.type;
		}

		product.save((err, result) => {
			if(err) {
				return res.status(400).json({
					error: errorHandler(err)
				});
			}
			res.json(result);
		});
	});
};

exports.remove = (req, res) => {
	let product = req.product;
	product.remove((err, deletedProduct) => {
		if(err) {
			return res.status(400).json({
				error: errorHandler(err)
			});
		}
		res.json({
			message: "Item deleted"
		});
	});
};


exports.update = (req, res) => {
	let form = new formidable.IncomingForm();
	form.keepExtensions = true;
	form.parse(req, (err, fields, files) => {
		if(err) {
			return res.status(400).json({
				error: 'Cannot upload image'
			});
		}
		// field check
		const {name, description, price, category, quantity, shipping} = fields;

		if(!name || !description || !price || !category || !quantity || !shipping) {
			return res.status(400).json({
				error: "You must specify all fields"
			});
		}

		let product = req.product;
		product = _.extend(product, fields);

		if(files.photo) {
			if(files.photo.size > 1000000)	{	// size over 1 mb
				return res.status.json({
					error: "Image must be smaller than 1mb"
				});
			}
			product.photo.data = fs.readFileSync(files.photo.path);
			product.photo.contentType = files.photo.type;
		}

		product.save((err, result) => {
			if(err) {
				return res.status(400).json({
					error: errorHandler(err)
				});
			}
			res.json(result);
		});
	});
};

exports.list = (req, res) => {
    let order = req.query.order ? req.query.order : 'asc';
    let sortBy = req.query.sortBy ? req.query.sortBy : '_id';
    let limit = req.query.limit ? parseInt(req.query.limit) : 6;

    Product.find()
        .select('-photo')
        .populate('category')
        .sort([[sortBy, order]])
        .limit(limit)
        .exec((err, products) => {
            if (err) {
                return res.status(400).json({
                    error: 'Products not found'
                });
            }
            res.json(products);
        });
};

exports.related = (req, res) => {		//lists products from the same category
	let limit = req.query.limit ? parseInt(req.query.limit) : 6;

	Product.find({_id: {$ne: req.product}, category: req.product.category})	//excludes current product from list
	.limit(limit)
	.populate('category', '_id name')
	.exec((err, products) => {
		if(err) {
			return res.staus(400).json({
				error: "items not found"
			});
		}
		res.json(products);
	});
};

exports.listCategories = (req, res) => {	//return all categories for a specific product
	Product.distinct('category', {}, (err, data) => {
		if(err) {
			return res.staus(400).json({
				error: "categories not found"
			});
		}
		res.json(data);
	});
};


// list products by search


 
exports.listBySearch = (req, res) => {
    let order = req.body.order ? req.body.order : "desc";
    let sortBy = req.body.sortBy ? req.body.sortBy : "_id";
    let limit = req.body.limit ? parseInt(req.body.limit) : 100;
    let skip = parseInt(req.body.skip);
    let findArgs = {};
 
    // console.log(order, sortBy, limit, skip, req.body.filters);
    // console.log("findArgs", findArgs);
 
    for (let key in req.body.filters) {
        if (req.body.filters[key].length > 0) {
            if (key === "price") {
                // gte -  greater than price [0-10]
                // lte - less than
                findArgs[key] = {
                    $gte: req.body.filters[key][0],
                    $lte: req.body.filters[key][1]
                };
            } else {
                findArgs[key] = req.body.filters[key];
            }
        }
    }
 
    Product.find(findArgs)
        .select("-photo")
        .populate("category")
        .sort([[sortBy, order]])
        .skip(skip)
        .limit(limit)
        .exec((err, data) => {
            if (err) {
                return res.status(400).json({
                    error: "Products not found"
                });
            }
            res.json({
                size: data.length,
                data
            });
        });
};

exports.photo = (req, res, next) => {
	if(req.product.photo.data) {
		res.set('Content-Type', req.product.photo.contentType);
		return res.send(req.product.photo.data);

	}
	next();
};

exports.listSearch = (req, res) => {
    // create query object to hold search value and category value
    const query = {};
    // assign search value to query.name
    if (req.query.search) {
        query.name = { $regex: req.query.search, $options: 'i' };
        // assigne category value to query.category
        if (req.query.category && req.query.category != 'All') {
            query.category = req.query.category;
        }
        // find the product based on query object with 2 properties
        // search and category
        Product.find(query, (err, products) => {
            if (err) {
                return res.status(400).json({
                    error: errorHandler(err)
                });
            }
            res.json(products);
        }).select('-photo');
    }
};