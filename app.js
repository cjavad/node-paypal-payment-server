const express = require("express");
const app = express();
const dotenv = require("dotenv");
dotenv.config();
const paypal = require('paypal-rest-sdk');
const activePayments = [];

paypal.configure({
    'mode': process.env.paypalApiMode, //sandbox or live
    'client_id': process.env.paypalClientID,
    'client_secret': process.env.paypalClientSecret
});


const store = {
    "0": 1000,
    "12": 0
}

app.get('/create', (req, res) => {
    const paypalRequest = {
        intent: 'sale',
        redirect_urls: {
            return_url: req.protocol + "://" + process.env.HOST + '/process',
            cancel_url: req.protocol + "://" + process.env.HOST + '/cancel',
        },
        payer: {
            payment_method: 'paypal'
        },
        transactions: [{
            amount: {
                total: store[req.query.duration],
                currency: 'USD'
            },
            description: 'VIP'
        }]
    }

    paypal.payment.create(JSON.stringify(paypalRequest), (error, payment) => {
        if (!error) {
            //capture HATEOAS links
            var links = {};
            payment.links.forEach((linkObj) => {
                links[linkObj.rel] = {
                    'href': linkObj.href,
                    'method': linkObj.method
                };
            });

            //if redirect url present, redirect user
            if (links.hasOwnProperty('approval_url')) {
                activePayments[payment.id] = {
                    id: payment.id,
                    payer: payment.payer,
                    total: store[req.query.duration],
                    steam: req.query.steam,
                    duration: req.query.duration
                }

                res.redirect(links['approval_url'].href);
            } else {
                res.end('No redirect URI present');
            }
        } else {
            console.log(error);
            res.end(error.toString());
        }
    });
});

app.get('/process', (req, res) => {
    const paymentId = req.query.paymentId;
    const payerId = { 'payer_id': req.query.PayerID };

    paypal.payment.execute(paymentId, payerId, (error, payment) => {
        if (!error) {
            if (payment.state == 'approved') {
                console.log(activePayments, paymentId);

                if (!activePayments.hasOwnProperty(paymentId)) {
                    return res.json({ 'message': 'Something went wrong, contact management.', redirect: '/' });
                }

                const payment = activePayments[paymentId];
                // Add SQL entry here
                //
                // steam id can be found in payment object
                //
                return res.json({ 'message': 'Payment completed successfully', redirect: '/' });
            } else {
                return res.json({ 'message': 'Something went wrong, contact management.', redirect: '/' });
            }
        }
    });
});

app.get('/cancel', (req, res) => {
    res.end();
});


app.listen(process.env.PORT || 3000, () => {
    console.log(`Listening on ${process.env.PORT || 3000}`);
})