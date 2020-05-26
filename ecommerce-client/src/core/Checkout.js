import React, {useState, useEffect} from 'react';
import Layout from './Layout';
import {Link} from 'react-router-dom';
import {getProducts, getBraintreeToken, processPayment, createOrder} from './apiCore';
import Card from './Card';
import {isAuthenticated} from '../auth';
import DropIn from "braintree-web-drop-in-react";
import {emptyCart} from './cartHelpers';

const Checkout = ({products}) => {
	const [data, setData] = useState({
		loading: false,
		success: false,
		clientToken: null,
		error: '',
		instance: {},
		address: ''
	});

	const userId = isAuthenticated() && isAuthenticated().user._id;
	const token = isAuthenticated() && isAuthenticated().token;

	const getToken = (userId, token) => {
		getBraintreeToken(userId, token).then(data => {
			if(data.error) {
				setData({...data, error: data.error});
			} else {
				setData({clientToken: data.clientToken});
			}
		});
	};

	useEffect(() => {
		getToken(userId, token)
	}, []);

	const getTotal = () => {
		return products.reduce((currentValue, nextValue) => {
			return currentValue + nextValue.count * nextValue.price
		}, 0);
	};

	const handleAddress = event => {
		setData({...data, address: event.target.value});
	};

	const showError = error => (
		<div className="alert alert-danger" style={{display: error ? '' : 'none'}}>
			{error}
		</div>
	);

	const showSuccess = success => (
		<div className="alert alert-info" style={{display: success ? '' : 'none'}}>
			Payment Processed
		</div>
	);

	
	const buy = () => {
		setData({loading: true});
		let nonce;
		
		let deliveryAddress = data.address;
		let getNonce = data.instance.requestPaymentMethod()
		.then(data => {
			
			nonce = data.nonce;

			const paymentData = {
				paymentMethodNonce: nonce,
				amount: getTotal(products)
			};
			processPayment(userId, token, paymentData)
			.then(response => {
				console.log(response);

				const createOrderData = {
					products: products,
					transaction_id: response.transaction.id,
					amount: response.transaction.amount,
					address: deliveryAddress
				};
				createOrder(userId, token, createOrderData);


				setData({...data, success: response.success});
				emptyCart(() => {
					console.log('Payment success');
					setData({loading: false, success: true});
				});
			})
			.catch(error => {
				console.log(error);
				setData({loading: false});
			});
		})
		.catch(error => {
			
			setData({...data, error: error.message});
		});

	};

	const showLoading = loading => loading && <h2>Loading Please Wait...</h2>;

	const showDropIn = () => (
		<div onBlur={() => setData({...data, error: ""})}>
			{data.clientToken !== null && products.length > 0 ? (
				<div>
					<div className="gorm-group mb-3">
						<label className="text-muted">Delivery address:</label>
						<textarea
							onChange={handleAddress}
							className="form-control"
							value={data.address}
							placeholder="Enter delivery address" />
					</div>
					<DropIn options={{
						authorization: data.clientToken,
						paypal: {
							flow: "vault"
						}
					}} onInstance={instance => (data.instance =instance)} />
					<button onClick={buy} className="btn btn-success btn-block">Purchase</button>
				</div>
				) : null}
		</div>
	);
	return <div>
		<h2>Total: ${getTotal()}</h2>
		{showLoading(data.loading)}
		{showError(data.error)}
		{showSuccess(data.success)}
		{isAuthenticated() ? (
			<div>{showDropIn()}</div>
			) : (
			<Link to="/signin">
			<button className="btn btn-primary">Sign in to Checkout</button>
			</Link>
			)}
	</div>;
};

export default Checkout;